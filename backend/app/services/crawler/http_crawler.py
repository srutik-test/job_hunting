"""
High-Performance Asynchronous HTTP Crawler.
Recursively crawls company websites with smart priority scheduling for careers, team, and contact pages.
"""
import asyncio
import re
import time
from typing import Set, List, Dict, Optional, Callable, Any
from urllib.parse import urljoin, urlparse, urldefrag
import httpx
from bs4 import BeautifulSoup
import json

from app.services.crawler.base import BaseCrawler, CrawlResult, CrawledPage
from app.services.crawler.page_classifier import classify_page_type, get_url_crawl_priority, is_internal_url
from app.services.crawler.sitemap_parser import SitemapParser
from app.core.config import settings


# Pre-compiled email extraction regex for high-speed scanning
EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
    re.IGNORECASE
)

# Obfuscated email patterns like name [at] domain [dot] com
OBFUSCATED_EMAIL_REGEX = re.compile(
    r"([a-zA-Z0-9_.+-]+)\s*(?:\[at\]|\(at\)|\s+at\s+|@)\s*([a-zA-Z0-9-]+)\s*(?:\[dot\]|\(dot\)|\s+dot\s+|\.)\s*([a-zA-Z0-9-.]+)",
    re.IGNORECASE
)

# Public LinkedIn company and profile URLs
LINKEDIN_URL_REGEX = re.compile(
    r"https?://(?:www\.)?linkedin\.com/(?:company|in|pub|school)/[a-zA-Z0-9_-]+/?",
    re.IGNORECASE
)


class AsyncHttpCrawler(BaseCrawler):
    """Production-ready asynchronous web crawler."""

    def __init__(
        self,
        timeout: float = 15.0,
        max_retries: int = 2,
        user_agent: Optional[str] = None
    ):
        self.timeout = timeout
        self.max_retries = max_retries
        self.user_agent = user_agent or settings.CRAWLER_USER_AGENT
        self.sitemap_parser = SitemapParser(timeout=10.0, user_agent=self.user_agent)

    async def crawl_company(
        self,
        base_url: str,
        company_name: str,
        max_pages: int = 25,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> CrawlResult:
        """
        Recursively crawl the target company website up to max_pages.
        Prioritizes Careers, Jobs, Hiring, Contact, Team, Leadership, People, and Sitemap.
        """
        start_time = time.time()
        
        # Ensure scheme
        if not base_url.startswith(("http://", "https://")):
            base_url = "https://" + base_url
        base_url = base_url.rstrip("/")

        parsed_base = urlparse(base_url)
        base_domain = parsed_base.netloc.lower().replace("www.", "")

        visited_urls: Set[str] = set()
        to_visit: List[tuple[int, str]] = []  # (priority, url)
        crawled_pages: List[CrawledPage] = []
        all_emails: Set[str] = set()
        all_linkedin_urls: Set[str] = set()
        errors: List[str] = []

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        }

        transport = httpx.AsyncHTTPTransport(retries=self.max_retries, verify=False)
        async with httpx.AsyncClient(
            transport=transport,
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        ) as client:
            
            # Step 1: Add homepage with highest priority
            to_visit.append((100, base_url))

            # Step 2: Discover standard career and contact endpoints explicitly
            candidate_paths = [
                "/careers", "/career", "/jobs", "/job", "/hiring", "/work-with-us",
                "/join-us", "/join-our-team", "/openings", "/contact", "/contact-us",
                "/contactus", "/about", "/about-us", "/team", "/our-team",
                "/leadership", "/people", "/departments"
            ]
            for path in candidate_paths:
                cand_url = urljoin(base_url, path)
                to_visit.append((90, cand_url))

            # Step 3: Fast sitemap discovery
            try:
                sitemap_urls = await self.sitemap_parser.discover_sitemap_urls(base_url, client)
                for s_url in sitemap_urls:
                    prio = get_url_crawl_priority(s_url)
                    to_visit.append((prio + 20, s_url))
            except Exception as e:
                errors.append(f"Sitemap check error: {str(e)}")

            # Crawl loop
            while to_visit and len(crawled_pages) < max_pages:
                # Pop highest priority URL
                to_visit.sort(key=lambda x: x[0], reverse=True)
                prio, current_url = to_visit.pop(0)

                # Normalize & clean URL
                current_url, _ = urldefrag(current_url)
                current_url = current_url.rstrip("/")

                if not current_url or current_url in visited_urls:
                    continue

                if not is_internal_url(base_domain, current_url):
                    continue

                visited_urls.add(current_url)

                if progress_callback:
                    try:
                        progress_callback({
                            "current_page": current_url,
                            "pages_crawled": len(crawled_pages),
                            "emails_count": len(all_emails),
                            "profiles_count": len(all_linkedin_urls),
                        })
                    except Exception:
                        pass

                try:
                    resp = await client.get(current_url)
                    status_code = resp.status_code

                    # Only process HTML responses
                    content_type = resp.headers.get("content-type", "").lower()
                    if "text/html" not in content_type and "application/xhtml" not in content_type:
                        continue

                    html = resp.text
                    soup = BeautifulSoup(html, "html.parser")

                    # Extract title & meta
                    title = soup.title.string.strip() if soup.title and soup.title.string else ""
                    meta_desc = ""
                    desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
                    if desc_tag and desc_tag.get("content"):
                        meta_desc = desc_tag["content"].strip()

                    # Classify page type
                    page_type = classify_page_type(current_url, title, meta_desc)

                    # Extract text content
                    for script_or_style in soup(["script", "style", "noscript", "svg"]):
                        script_or_style.extract()
                    visible_text = soup.get_text(separator=" ", strip=True)

                    # 1. Direct Regex Email Search on visible text and raw HTML
                    page_emails = set()
                    for em in EMAIL_REGEX.findall(html):
                        cleaned_em = em.strip().lower().rstrip(".,;:'\"")
                        if self._is_valid_email_candidate(cleaned_em, base_domain):
                            page_emails.add(cleaned_em)

                    # 2. Extract mailto: links
                    for mailto in soup.select('a[href^="mailto:"]'):
                        href = mailto.get("href", "")
                        raw_email = href.replace("mailto:", "").split("?")[0].strip().lower()
                        if self._is_valid_email_candidate(raw_email, base_domain):
                            page_emails.add(raw_email)

                    # 3. Obfuscated email patterns
                    for match in OBFUSCATED_EMAIL_REGEX.finditer(visible_text):
                        u, d, t = match.groups()
                        obf_email = f"{u}@{d}.{t}".strip().lower()
                        if self._is_valid_email_candidate(obf_email, base_domain):
                            page_emails.add(obf_email)

                    all_emails.update(page_emails)

                    # Extract LinkedIn Profile & Company Links
                    page_linkedin = set()
                    for a in soup.find_all("a", href=True):
                        href = a["href"].strip()
                        if "linkedin.com" in href.lower():
                            clean_li = self._clean_linkedin_url(href)
                            if clean_li:
                                page_linkedin.add(clean_li)

                    all_linkedin_urls.update(page_linkedin)

                    # Extract JSON-LD structured data (Person, JobPosting, ContactPoint)
                    json_ld_list = []
                    for script in soup.find_all("script", type="application/ld+json"):
                        try:
                            if script.string:
                                data = json.loads(script.string)
                                if isinstance(data, dict):
                                    json_ld_list.append(data)
                                    # Scan for email inside json_ld
                                    self._extract_jsonld_emails(data, page_emails, base_domain)
                                elif isinstance(data, list):
                                    for item in data:
                                        if isinstance(item, dict):
                                            json_ld_list.append(item)
                                            self._extract_jsonld_emails(item, page_emails, base_domain)
                        except Exception:
                            pass

                    # Discover next links
                    page_links = []
                    for a in soup.find_all("a", href=True):
                        href = a["href"].strip()
                        full_url = urljoin(current_url, href)
                        full_url, _ = urldefrag(full_url)
                        full_url = full_url.rstrip("/")

                        if is_internal_url(base_domain, full_url) and full_url not in visited_urls:
                            prio = get_url_crawl_priority(full_url)
                            if prio >= 0:
                                page_links.append(full_url)
                                to_visit.append((prio, full_url))

                    # Record page
                    crawled_pages.append(CrawledPage(
                        url=current_url,
                        status_code=status_code,
                        title=title,
                        text_content=visible_text[:10000],  # Keep first 10k chars for performance
                        html_content="",  # Don't keep raw HTML in memory to save RAM
                        links=page_links[:30],
                        page_type=page_type,
                        discovered_emails=list(page_emails),
                        discovered_linkedin_urls=list(page_linkedin),
                        meta_description=meta_desc,
                        json_ld_data=json_ld_list
                    ))

                    # Modest sleep between pages to be polite to target servers
                    await asyncio.sleep(0.05)

                except Exception as e:
                    errors.append(f"Error crawling {current_url}: {str(e)}")

        duration = time.time() - start_time
        return CrawlResult(
            base_url=base_url,
            pages_crawled=len(crawled_pages),
            pages=crawled_pages,
            all_emails=all_emails,
            all_linkedin_urls=all_linkedin_urls,
            sitemap_found=bool(sitemap_urls if 'sitemap_urls' in locals() else False),
            duration_seconds=round(duration, 2),
            errors=errors
        )

    def _is_valid_email_candidate(self, email: str, base_domain: str) -> bool:
        """Validate email string structure and filter common asset false positives."""
        if not email or "@" not in email:
            return False
        
        # Filter common file extension matches (e.g. image@2x.png, bootstrap@5.3.min.css)
        invalid_endings = (
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js",
            ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".ico", ".pdf"
        )
        if email.endswith(invalid_endings):
            return False

        if len(email) < 6 or len(email) > 100:
            return False

        # Domain part must have a dot
        parts = email.split("@")
        if len(parts) != 2 or "." not in parts[1]:
            return False

        # Ignore template examples like name@domain.com, you@example.com
        if parts[1] in ("example.com", "domain.com", "yoursite.com", "email.com", "sample.com"):
            return False

        return True

    def _clean_linkedin_url(self, url: str) -> Optional[str]:
        """Normalize LinkedIn URL."""
        if not url:
            return None
        # Remove tracking parameters
        clean = url.split("?")[0].rstrip("/")
        if "linkedin.com/in/" in clean or "linkedin.com/company/" in clean or "linkedin.com/school/" in clean:
            if not clean.startswith(("http://", "https://")):
                clean = "https://" + clean
            return clean
        return None

    def _extract_jsonld_emails(self, data: Dict[str, Any], emails_set: Set[str], base_domain: str) -> None:
        """Extract email fields from JSON-LD schema objects."""
        if isinstance(data, dict):
            for k, v in data.items():
                if k.lower() == "email" and isinstance(v, str):
                    clean = v.strip().lower()
                    if self._is_valid_email_candidate(clean, base_domain):
                        emails_set.add(clean)
                elif isinstance(v, (dict, list)):
                    self._extract_jsonld_emails(v, emails_set, base_domain)
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, (dict, list)):
                    self._extract_jsonld_emails(item, emails_set, base_domain)
