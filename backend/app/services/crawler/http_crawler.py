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

import html as html_lib
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

EMAIL_REGEX = re.compile(
    r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,24}\b",
    re.I,
)
OBFUSCATED = re.compile(
    r"([a-zA-Z0-9_.+-]+)\s*(?:\[at\]|\(at\)|\{at\}|&#64;|&commat;)\s*([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\s*(?:\[dot\]|\(dot\)|\{dot\}|&#46;)\s*([a-zA-Z]{2,24})",
    re.I,
)
EMAIL_ATTR_REGEX = re.compile(
    r'(?:data-email|data-mail|data-address)\s*=\s*["\']([^"\']+)["\']', re.I
)
PHONE_REGEX = re.compile(
    r'(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}'
)


def valid_phone_candidate(phone_str: str) -> Optional[str]:
    if not phone_str:
        return None
    raw = phone_str.strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 7 or len(digits) > 15:
        return None
    if len(set(digits)) <= 2:
        return None
    if digits in ("1234567", "12345678", "123456789", "1234567890", "9876543210"):
        return None
    cleaned = re.sub(r"[\s\t\r\n]+", " ", raw).strip()
    return cleaned


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

IGNORED_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "domain.com",
    "email.com",
    "sample.com",
    "test.com",
    "yourcompany.com",
    "company.com",
    "sentry.io",
    "sentry.wixpress.com",
    "wixpress.com",
    "github.com",
    "schema.org",
    "w3.org",
    "cloudflare.com",
    "doubleclick.net",
    "fontawesome.com",
    "reactjs.org",
    "googleapis.com",
    "gravatar.com",
    "wordpress.org",
    "polyfill.io",
    "intercom.io",
    "google-analytics.com",
    "googletagmanager.com",
    "scale.business",
    "scale.frameworks",
}

# Recognized / IANA Top-Level Domains
RECOGNIZED_TLDS = {
    "com", "org", "net", "edu", "gov", "io", "co", "ai", "in", "uk", "de", "ca", "au", "fr",
    "tech", "dev", "app", "agency", "global", "solutions", "services", "digital", "cloud",
    "consulting", "info", "biz", "me", "us", "eu", "cc", "tv", "so", "sg", "hk", "ae", "sa",
    "nl", "es", "it", "ch", "se", "no", "fi", "dk", "br", "mx", "jp", "kr", "cn", "tw", "za",
    "nz", "ie", "pl", "cz", "at", "be", "ru", "ua", "ro", "gr", "pt", "ph", "my", "id", "th",
    "vn", "ng", "ke", "eg", "pk", "bd", "lk", "careers", "jobs", "work", "team", "company",
    "network", "group", "media", "design", "studio", "marketing", "software", "systems",
    "ventures", "capital", "partners", "foundation", "academy", "institute", "school",
    "university", "online", "site", "store", "shop", "pro", "club", "live", "world", "life",
    "space", "link", "click", "help", "zone", "today", "email", "chat", "direct", "center",
    "community", "expert", "guru", "ninja", "events", "guide", "tips", "management",
    "properties", "legal", "financial", "finance", "health", "care", "clinic", "dental",
    "doctor", "hospital", "security", "energy", "engineering", "construction", "contractors",
    "builders", "cleaning", "catering", "restaurant", "travel", "tours", "flights", "hotel",
    "realestate", "realty", "holdings", "enterprises", "international", "express", "delivery",
    "logistics", "transport", "auto", "motor", "cars", "codes", "technology", "host",
    "hosting", "server", "domains", "contact", "int", "mil", "mobi", "asia", "xxx", "post",
    "co.in", "co.uk", "org.uk", "gov.in", "ac.uk", "edu.in", "gov.uk", "com.au", "net.au",
    "co.nz", "com.sg", "co.za", "com.br", "co.jp", "ne.jp", "com.mx", "co.kr", "org.in", "gen.in"
}

# English words/stopwords that appear in text sentences that must NEVER be treated as TLDs
ENGLISH_WORDS_NOT_TLDS = {
    "we", "before", "explore", "whether", "handoff", "about", "after", "again", "against",
    "all", "also", "and", "any", "because", "been", "being", "below", "between", "both",
    "but", "can", "cannot", "could", "did", "does", "doing", "down", "during", "each",
    "few", "for", "from", "further", "had", "has", "have", "having", "he", "her", "here",
    "hers", "herself", "him", "himself", "his", "how", "into", "its", "itself",
    "just", "more", "most", "myself", "nor", "not", "now", "off", "once", "only",
    "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should",
    "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then",
    "there", "these", "they", "this", "those", "through", "too", "under", "until",
    "very", "was", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "with", "would", "you", "your", "yours", "yourself", "yourselves", "customers",
    "scale", "night", "property", "broken", "workloads", "disappear", "perform"
}

# Common noise words in text that should never be standalone email local parts
FAKE_LOCAL_PARTS = {
    "broken", "workloads", "up", "disappear", "property", "perform", "click", "read", "learn",
    "view", "see", "get", "take", "make", "know", "think", "come", "give", "find", "tell",
    "ask", "seem", "feel", "try", "leave", "call", "good", "new", "first", "last",
    "long", "great", "little", "own", "other", "old", "right", "big", "high", "different",
    "small", "large", "next", "early", "young", "important", "few", "public", "bad",
    "same", "able", "example", "sample", "test", "demo", "placeholder"
}

VALID_TLD_REGEX = re.compile(r"^[a-zA-Z]{2,24}$")

ProgressCallback = Optional[Callable[[Dict[str, Any]], Awaitable[Optional[bool]]]]


def decode_cloudflare_email(cfemail: str) -> Optional[str]:
    """Decode Cloudflare XOR-encoded email from data-cfemail attribute."""
    try:
        cfemail = cfemail.strip()
        if len(cfemail) < 4 or len(cfemail) % 2 != 0:
            return None
        k = int(cfemail[:2], 16)
        email = "".join(
            chr(int(cfemail[i : i + 2], 16) ^ k) for i in range(2, len(cfemail), 2)
        )
        return email.strip().lower()
    except Exception:
        return None


def valid_email_candidate(email: str, base_domain: Optional[str] = None) -> bool:
    """Reject asset files, templates, CSS/JS artifacts, prose sentence matches, and fake noise domains."""
    if not email or len(email) < 6 or len(email) > 90:
        return False
    email = email.strip().lower().rstrip(".,;:'\"()[]{}<>!?-")
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
        ".json",
        ".xml",
        ".map",
        ".zip",
        ".gz",
        ".tar",
    )
    if email.endswith(bad_endings):
        return False
    parts = email.split("@")
    if len(parts) != 2:
        return False
    local, domain = parts[0].strip(), parts[1].strip()
    if not local or not domain or "." not in domain:
        return False

    # Local part checks
    if local.startswith(".") or local.endswith(".") or ".." in local:
        return False
    if local in FAKE_LOCAL_PARTS:
        return False

    # Domain part checks
    if domain.startswith((".", "-")) or domain.endswith((".", "-")) or ".." in domain:
        return False

    # Must have a valid alphabetic TLD
    domain_parts = domain.split(".")
    tld = domain_parts[-1]
    if not VALID_TLD_REGEX.match(tld) or tld in ENGLISH_WORDS_NOT_TLDS:
        return False

    # Check recognized TLDs or valid ccTLD/gTLD
    if tld not in RECOGNIZED_TLDS:
        if len(domain_parts) >= 2:
            two_part = f"{domain_parts[-2]}.{domain_parts[-1]}"
            if two_part not in RECOGNIZED_TLDS and len(tld) > 4:
                return False
        else:
            return False

    # Filter known noise / library domains
    if domain in IGNORED_DOMAINS or any(
        domain.endswith("." + d) for d in IGNORED_DOMAINS
    ):
        return False

    # Reject hash-like local parts on analytics/logging domains
    if re.fullmatch(r"u?[0-9a-f]{5,}", local) and (
        "sentry" in domain or "wix" in domain or "log" in domain
    ):
        return False

    # Check for placeholder template strings
    if local in ("your-email", "youremail", "email-address", "name@domain", "email", "username"):
        return False

    return True


class HttpCrawler:
    engine = "http"

    def __init__(
        self,
        timeout: float = 30.0,
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
        all_phones: Set[str] = set()
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
                "/contactus",
                "/get-in-touch",
                "/reach-us",
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
                "/connect",
                "/offices",
                "/locations",
                "/support",
                "/enquiry",
                "/inquiry",
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
                all_phones.update(page.phones)
                all_li.update(page.linkedin_urls)

                # secondary internal links from the page
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
            all_phones=all_phones,
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
        json_ld: List[Any] = []

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
                        if isinstance(data, list):
                            for item in data:
                                if isinstance(item, dict):
                                    json_ld.append(item)
                                elif isinstance(item, list):
                                    json_ld.extend([x for x in item if isinstance(x, dict)])
                        elif isinstance(data, dict):
                            if "@graph" in data and isinstance(data["@graph"], list):
                                for item in data["@graph"]:
                                    if isinstance(item, dict):
                                        json_ld.append(item)
                            json_ld.append(data)
                except (ValueError, TypeError):
                    continue

        page_type = classify_page_type(url, title, meta_desc)

        # ---- email extraction with context
        emails: Set[str] = set()
        phones: Set[str] = set()
        contexts: List[Dict[str, str]] = []

        if soup:
            # 1) Cloudflare email protection decoding (data-cfemail attribute)
            for tag in soup.select("[data-cfemail], .__cf_email__"):
                cf = tag.get("data-cfemail") or tag.get("data-email")
                if cf:
                    decoded = decode_cloudflare_email(cf)
                    if decoded and valid_email_candidate(decoded, base_domain):
                        emails.add(decoded)
                        parent_text = " ".join(
                            (
                                tag.parent.get_text(" ", strip=True)
                                if tag.parent
                                else tag.get_text(" ", strip=True)
                            ).split()
                        )[:400]
                        contexts.append({"email": decoded, "context": parent_text})

            # 2) mailto: links (highest signal) — capture nearby context
            for a in soup.select('a[href^="mailto:"]'):
                href = a.get("href", "")
                raw = href.replace("mailto:", "").split("?")[0].strip().lower()
                raw = html_lib.unescape(raw)
                if valid_email_candidate(raw, base_domain):
                    emails.add(raw)
                    parent_text = " ".join(
                        (
                            a.parent.get_text(" ", strip=True)
                            if a.parent
                            else a.get_text(" ", strip=True)
                        ).split()
                    )[:400]
                    contexts.append({"email": raw, "context": parent_text})

            # 3) tel: links
            for a in soup.select('a[href^="tel:"]'):
                href = a.get("href", "")
                raw = href.replace("tel:", "").split("?")[0].strip()
                cand_phone = valid_phone_candidate(raw)
                if cand_phone:
                    phones.add(cand_phone)

            # 4) Attribute-based (data-email, data-mail, data-address, data-phone, data-tel)
            for tag in (
                soup.find_all(attrs={"data-email": True})
                + soup.find_all(attrs={"data-mail": True})
                + soup.find_all(attrs={"data-address": True})
            ):
                val = (
                    tag.get("data-email")
                    or tag.get("data-mail")
                    or tag.get("data-address")
                    or ""
                )
                val = (
                    html_lib.unescape(val)
                    .replace("[at]", "@")
                    .replace("[dot]", ".")
                    .strip()
                    .lower()
                )
                if valid_email_candidate(val, base_domain):
                    emails.add(val)
                    parent_text = " ".join(tag.get_text(" ", strip=True).split())[:400]
                    contexts.append({"email": val, "context": parent_text})

            for tag in soup.find_all(attrs={"data-phone": True}) + soup.find_all(
                attrs={"data-tel": True}
            ):
                val = tag.get("data-phone") or tag.get("data-tel") or ""
                cand_phone = valid_phone_candidate(val)
                if cand_phone:
                    phones.add(cand_phone)

        # 5) JSON-LD Person/Organization emails & phones
        self._jsonld_emails(json_ld, emails, base_domain)
        self._jsonld_phones(json_ld, phones)

        # 6) Clean visible text extraction (after stripping script, style, svg, noscript, etc.)
        visible_text = ""
        if soup:
            for junk in soup(
                ["script", "style", "noscript", "svg", "canvas", "template"]
            ):
                junk.decompose()
            visible_text = html_lib.unescape(soup.get_text(" ", strip=True))

            # Regex on cleaned visible text only (never raw HTML minified code)
            for em in EMAIL_REGEX.findall(visible_text):
                cleaned = em.strip().lower().rstrip(".,;:'\"()[]{}<>")
                if valid_email_candidate(cleaned, base_domain):
                    emails.add(cleaned)

            for match in OBFUSCATED.finditer(visible_text):
                u, d, t = match.groups()
                cand = f"{u}@{d}.{t}".strip().lower().rstrip(".,;:'\"()[]{}<>")
                if valid_email_candidate(cand, base_domain):
                    emails.add(cand)

            for pmatch in PHONE_REGEX.findall(visible_text):
                cand_phone = valid_phone_candidate(pmatch)
                if cand_phone:
                    phones.add(cand_phone)

        # text context for emails found via regex (window search in visible text)
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
            phones=sorted(phones)[:10],
            linkedin_urls=sorted(linkedin),
            meta_description=meta_desc,
            json_ld=json_ld,
            email_contexts=contexts,
        )

    @staticmethod
    def _jsonld_emails(
        data: Any, out: Set[str], base_domain: Optional[str] = None
    ) -> None:
        if isinstance(data, dict):
            for k, v in data.items():
                if k.lower() == "email" and isinstance(v, str):
                    cand = v.strip().lower()
                    if valid_email_candidate(cand, base_domain):
                        out.add(cand)
                elif isinstance(v, (dict, list)):
                    HttpCrawler._jsonld_emails(v, out, base_domain)
        elif isinstance(data, list):
            for item in data:
                HttpCrawler._jsonld_emails(item, out, base_domain)

    @staticmethod
    def _jsonld_phones(data: Any, out: Set[str]) -> None:
        if isinstance(data, dict):
            for k, v in data.items():
                if k.lower() in ("telephone", "phone", "faxnumber") and isinstance(
                    v, str
                ):
                    cand = valid_phone_candidate(v)
                    if cand:
                        out.add(cand)
                elif isinstance(v, (dict, list)):
                    HttpCrawler._jsonld_phones(v, out)
        elif isinstance(data, list):
            for item in data:
                HttpCrawler._jsonld_phones(item, out)
