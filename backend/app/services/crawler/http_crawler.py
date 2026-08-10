"""
Domain-restricted asynchronous HTTP crawler.

Guarantees:
* Stays on the company's own domain (and sub-domains) only.
* Honours robots.txt when CRAWLER_RESPECT_ROBOTS is enabled.
* Deduplicates URLs, follows redirects, caps the number of pages,
  handles common HTTP errors and never loops forever.
* Flags JavaScript-heavy pages (result.needs_js) so the orchestrator can
  fall back to a browser-based provider.
"""

import json
import re
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse, urldefrag

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings
from app.services.crawler.base import CrawledPage, CrawlResult
from app.services.crawler.page_classifier import (
    classify_page_type,
    get_url_crawl_priority,
    is_internal_url,
)
from app.services.crawler.sitemap import SitemapParser

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", re.I)
OBFUSCATED = re.compile(
    r"([a-zA-Z0-9_.+-]+)\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+|\s+AT\s+)"
    r"\s*([a-zA-Z0-9-]+)\s*(?:\[dot\]|\(dot\)|\{dot\}|\s+dot\s+|\.)\s*([a-zA-Z0-9-.]+)",
    re.I,
)
EMAIL_ATTR_REGEX = re.compile(
    r'(?:data-email|data-mail|data-address)\s*=\s*["\']([^"\']+)["\']', re.I
)
LINKEDIN_RE = re.compile(
    r"https?://(?:[\w.-]+\.)?linkedin\.com/(?:company|in|pub|school)/[a-zA-Z0-9_-]+/?",
    re.I,
)
BLOCK_MARKERS = [
    "cf-error",
    "cf-browser-verification",
    "attention required! | cloudflare",
    "checking your browser",
    "just a moment",
    "ddos-guard",
    "px-captcha",
    "akamai",
    "access denied | robots",
    "perimeterx",
]

ProgressCallback = Optional[Callable[[Dict[str, Any]], Awaitable[Optional[bool]]]]
# callback receives {current_page, pages_crawled, emails_count}; if it returns
# False the crawl is cancelled cooperatively.


def valid_email_candidate(email: str) -> bool:
    """Reject asset files, templates and obviously invalid matches."""
    if not email or len(email) < 6 or len(email) > 100:
        return False
    bad_endings = (
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".webp",
        ".css",
        ".js",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".mp4",
        ".ico",
        ".pdf",
        ".html",
    )
    if email.endswith(bad_endings):
        return False
    parts = email.split("@")
    if len(parts) != 2 or "." not in parts[1]:
        return False
    if parts[1] in (
        "example.com",
        "example.org",
        "domain.com",
        "email.com",
        "sample.com",
        "test.com",
        "sentry.io",
        "sentry.wixpress.com",
    ):
        return False
    # hash-like local parts on sentry noise domains
    if re.fullmatch(r"u?[0-9a-f]{5,}", parts[0]) and parts[1].endswith("sentry.io"):
        return False
    return True


class HttpCrawler:
    engine = "http"

    def __init__(
        self,
        timeout: float = 15.0,
        max_pages: int = 30,
        user_agent: Optional[str] = None,
    ):
        self.timeout = timeout
        self.max_pages = max_pages
        self.user_agent = user_agent or settings.CRAWLER_USER_AGENT
        self.sitemap = SitemapParser(timeout=10.0, user_agent=self.user_agent)

    async def crawl_company(
        self,
        base_url: str,
        company_name: str = "",
        progress_callback: ProgressCallback = None,
    ) -> CrawlResult:
        start = time.time()
        if not base_url.startswith(("http://", "https://")):
            base_url = "https://" + base_url
        base_url = base_url.rstrip("/")
        base_domain = (urlparse(base_url).netloc or "").lower().removeprefix("www.")

        visited: Set[str] = set()
        queue: List[tuple[int, str]] = []
        pages: List[CrawledPage] = []
        all_emails: Set[str] = set()
        all_li: Set[str] = set()
        errors: List[str] = []
        robots_disallowed = 0
        needs_js = False
        blocked = False
        blocked_reason = ""

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        transport = httpx.AsyncHTTPTransport(retries=settings.CRAWLER_MAX_RETRIES)
        async with httpx.AsyncClient(
            transport=transport,
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        ) as client:
            # robots.txt
            robots = await self._load_robots(base_url, base_domain, client)

            queue.append((100, base_url))
            for path in (
                "/contact",
                "/contact-us",
                "/careers",
                "/career",
                "/jobs",
                "/about",
                "/about-us",
                "/team",
                "/our-team",
                "/people",
                "/leadership",
                "/hr",
                "/human-resources",
                "/recruitment",
                "/work-with-us",
                "/join-us",
            ):
                queue.append((90, urljoin(base_url, path)))

            try:
                sitemap_urls, sitemap_found = await self.sitemap.discover_sitemap_urls(
                    base_url, client
                )
            except Exception as exc:
                sitemap_urls, sitemap_found = [], False
                errors.append(f"Sitemap discovery failed: {exc}")

            for u in sitemap_urls:
                prio = get_url_crawl_priority(u)
                if prio > 0:
                    queue.append((prio + 20, u))

            while queue and len(pages) < self.max_pages:
                queue.sort(key=lambda x: x[0], reverse=True)
                _, current = queue.pop(0)
                current, _frag = urldefrag(current)
                current = current.rstrip("/")
                if not current or current in visited:
                    continue
                if not is_internal_url(base_domain, current):
                    continue
                if robots is not None and not robots.can_fetch(
                    self.user_agent, current
                ):
                    robots_disallowed += 1
                    continue

                visited.add(current)

                if progress_callback:
                    keep_going = await progress_callback(
                        {
                            "current_page": current,
                            "pages_crawled": len(pages),
                            "emails_count": len(all_emails),
                        }
                    )
                    if keep_going is False:
                        errors.append("Crawl cancelled.")
                        break

                try:
                    resp = await client.get(current)
                except httpx.TimeoutException:
                    errors.append(f"Timeout fetching {current}")
                    continue
                except httpx.RequestError as exc:
                    errors.append(f"Fetch error on {current}: {exc.__class__.__name__}")
                    continue

                status = resp.status_code
                if status in (401, 403):
                    errors.append(f"HTTP {status} (blocked) on {current}")
                    if status == 403 and not blocked:
                        body_lower = resp.text[:2000].lower() if resp.text else ""
                        if any(m in body_lower for m in BLOCK_MARKERS):
                            blocked = True
                            blocked_reason = "Anti-bot protection detected (HTTP 403)."
                    continue
                if status == 429:
                    errors.append(f"Rate-limited (429) on {current}")
                    continue
                if status >= 400:
                    continue

                ctype = resp.headers.get("content-type", "").lower()
                html = resp.text if resp.status_code else ""
                is_html = (
                    "text/html" in ctype
                    or "application/xhtml" in ctype
                    or (
                        html.lstrip()[:15]
                        .lower()
                        .startswith(("<!doctype html", "<html"))
                    )
                )
                if not is_html:
                    continue
                body_lower = html[:3000].lower()
                if not blocked and any(m in body_lower for m in BLOCK_MARKERS):
                    blocked = True
                    blocked_reason = "Anti-bot protection detected in page content."

                page = self._parse_page(current, status, html, base_domain)

                # JS-only heuristic: tiny visible text + heavy script usage
                if len(page.text_content) < 220 and (
                    "__NEXT_DATA__" in html
                    or '<div id="app"></div>' in html
                    or '<div id="root"></div>' in html
                    or html.count("<script") > 12
                ):
                    needs_js = True

                pages.append(page)
                all_emails.update(page.emails)
                all_li.update(page.linkedin_urls)

                # secondary internal links from the page (already-pruned)
                for link in page.links:
                    if link not in visited and is_internal_url(base_domain, link):
                        prio = get_url_crawl_priority(link)
                        if prio > 0:
                            queue.append((prio, link))

        result = CrawlResult(
            base_url=base_url,
            base_domain=base_domain,
            pages=pages,
            pages_crawled=len(pages),
            all_emails=all_emails,
            all_linkedin_urls=all_li,
            sitemap_found=sitemap_found,
            robots_disallowed=robots_disallowed,
            needs_js=needs_js,
            blocked=blocked,
            blocked_reason=blocked_reason,
            duration_seconds=round(time.time() - start, 2),
            errors=errors,
            engine=self.engine,
        )
        return result

    # ---------------------------------------------------------------- helpers
    async def _load_robots(
        self, base_url: str, base_domain: str, client: httpx.AsyncClient
    ):
        if not settings.CRAWLER_RESPECT_ROBOTS:
            return None
        try:
            from urllib.robotparser import RobotFileParser

            resp = await client.get(f"{base_url}/robots.txt", timeout=8.0)
            if resp.status_code != 200:
                return None
            rp = RobotFileParser()
            rp.parse(resp.text.splitlines())
            return rp
        except Exception:
            return None

    def _parse_page(
        self, url: str, status: int, html: str, base_domain: str
    ) -> CrawledPage:
        soup = BeautifulSoup(html, "lxml") if html else None
        title, meta_desc = "", ""
        json_ld: List[Dict[str, Any]] = []

        if soup:
            if soup.title and soup.title.string:
                title = soup.title.string.strip()
            desc = soup.find("meta", attrs={"name": "description"}) or soup.find(
                "meta", attrs={"property": "og:description"}
            )
            if desc and desc.get("content"):
                meta_desc = desc["content"].strip()
            for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
                try:
                    if tag.string:
                        data = json.loads(tag.string)
                        json_ld.append(data)
                except (ValueError, TypeError):
                    continue

        page_type = classify_page_type(url, title, meta_desc)

        # ---- email extraction with context
        emails: Set[str] = set()
        contexts: List[Dict[str, str]] = []

        # 1) mailto: links (highest signal) — capture nearby context
        if soup:
            for a in soup.select('a[href^="mailto:"]'):
                href = a.get("href", "")
                raw = href.replace("mailto:", "").split("?")[0].strip().lower()
                if valid_email_candidate(raw):
                    emails.add(raw)
                    parent_text = " ".join(
                        (
                            a.parent.get_text(" ", strip=True)
                            if a.parent
                            else a.get_text(" ", strip=True)
                        ).split()
                    )[:400]
                    contexts.append({"email": raw, "context": parent_text})

        # 2) raw HTML + visible text regex (catches cfemail-free text; also manifests etc.)
        visible_text = ""
        if soup:
            for junk in soup(["script", "style", "noscript"]):
                junk.decompose()
            visible_text = soup.get_text(" ", strip=True)

        for em in EMAIL_REGEX.findall(html):
            cleaned = em.strip().lower().rstrip(".,;:'\"")
            if valid_email_candidate(cleaned):
                emails.add(cleaned)

        for match in OBFUSCATED.finditer(visible_text):
            u, d, t = match.groups()
            cand = f"{u}@{d}.{t}".strip().lower()
            if valid_email_candidate(cand):
                emails.add(cand)

        # 3) attribute-based (data-email, obfuscation schemes)
        for raw in EMAIL_ATTR_REGEX.findall(html):
            cand = raw.replace("[at]", "@").replace("[dot]", ".").strip().lower()
            for em in EMAIL_REGEX.findall(cand):
                if valid_email_candidate(em):
                    emails.add(em)

        # 4) JSON-LD Person/Organization emails
        self._jsonld_emails(json_ld, emails)

        # text context for emails found via raw regex (rough window)
        for em in emails - {c["email"] for c in contexts}:
            idx = visible_text.lower().find(em)
            window = ""
            if idx != -1:
                window = visible_text[max(0, idx - 180) : idx + len(em) + 180]
            contexts.append({"email": em, "context": window})

        # ---- internal links
        links: Set[str] = set()
        if BeautifulSoup and soup:
            for tag in soup.find_all("a", href=True):
                href = tag["href"].strip()
                if href.startswith(("mailto:", "tel:", "javascript:", "#")):
                    continue
                absolute = urljoin(url, href)
                absolute, _f = urldefrag(absolute)
                links.add(absolute.rstrip("/"))

        # ---- LinkedIn urls
        linkedin: Set[str] = set()
        for m in LINKEDIN_RE.findall(html):
            clean = m.split("?")[0].rstrip("/")
            if clean:
                linkedin.add(clean)

        return CrawledPage(
            url=url,
            status_code=status,
            title=title,
            text_content=visible_text[:60000],
            html_content="",
            links=list(links)[:200],
            page_type=page_type,
            emails=sorted(emails),
            linkedin_urls=sorted(linkedin),
            meta_description=meta_desc,
            json_ld=json_ld,
            email_contexts=contexts,
        )

    @staticmethod
    def _jsonld_emails(data: Any, out: Set[str]) -> None:
        if isinstance(data, dict):
            for k, v in data.items():
                if k.lower() == "email" and isinstance(v, str):
                    cand = v.strip().lower()
                    if valid_email_candidate(cand):
                        out.add(cand)
                elif isinstance(v, (dict, list)):
                    HttpCrawler._jsonld_emails(v, out)
        elif isinstance(data, list):
            for item in data:
                HttpCrawler._jsonld_emails(item, out)
