"""
Firecrawl crawling provider (paid, with free trial/limited credits).

Used when a website is JavaScript-heavy or blocks plain HTTP crawling.
Only real Firecrawl API responses are used – nothing is synthesized.
"""

from typing import Any, Awaitable, Callable, Dict, Optional

import httpx

from app.core.config import settings
from app.services.crawler.base import CrawlResult
from app.services.crawler.http_crawler import HttpCrawler
from app.services.providers.base import (
    CapabilityProvider,
    ProviderRegistry,
    TestResult,
    call_with_timing,
)

ProgressCallback = Optional[Callable[[Dict[str, Any]], Awaitable[Optional[bool]]]]


class FirecrawlProvider(CapabilityProvider):
    key = "firecrawl"
    display_name = "Firecrawl Web Crawling"
    capabilities = ["crawler"]
    is_free = False
    requires_api_key = True
    env_key_names = ["FIRECRAWL_API_KEY"]
    signup_url = "https://www.firecrawl.dev/"

    @property
    def _base(self) -> str:
        return settings.FIRECRAWL_BASE_URL.rstrip("/")

    async def test_connection(self, api_key: Optional[str] = None) -> TestResult:
        key = api_key or settings.FIRECRAWL_API_KEY
        if not key:
            return TestResult(ok=False, message="No API key configured.")
        resp, latency, err = await call_with_timing(
            "GET",
            f"{self._base}/v1/team/credit-usage",
            headers={"Authorization": f"Bearer {key}"},
        )
        if err:
            return TestResult(
                ok=False, message=f"Request failed: {err}", latency_ms=latency
            )
        assert resp is not None
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            return TestResult(
                ok=True,
                message="Connected to Firecrawl.",
                latency_ms=latency,
                details={
                    "remaining_credits": data.get("remaining_credits"),
                    "plan_credits": data.get("plan_credits"),
                },
            )
        if resp.status_code in (401, 403):
            return TestResult(
                ok=False,
                message="Invalid API key (401/403 from Firecrawl).",
                latency_ms=latency,
            )
        return TestResult(
            ok=False,
            message=f"Firecrawl returned HTTP {resp.status_code}.",
            latency_ms=latency,
        )

    async def crawl_company(
        self,
        base_url: str,
        company_name: str = "",
        progress_callback: ProgressCallback = None,
        api_key: Optional[str] = None,
    ) -> CrawlResult:
        """Scrape the most relevant pages through Firecrawl and parse them
        locally with the shared HTTP-crawler extractor."""
        key = api_key or settings.FIRECRAWL_API_KEY
        http = HttpCrawler(max_pages=settings.CRAWLER_MAX_PAGES_PER_COMPANY)

        # Reuse the domain discovery of the light crawler to find target URLs,
        # then render each through Firecrawl.
        pre = await http.crawl_company(base_url, company_name, None)
        if not base_url.startswith(("http://", "https://")):
            base_url = "https://" + base_url
        base_url = base_url.rstrip("/")

        targets = [base_url] + [p.url for p in pre.pages[:8]]
        pages = []
        errors = list(pre.errors)
        import time as _time

        start = _time.time()
        all_emails = set(pre.all_emails)
        all_li = set(pre.all_linkedin_urls)

        async with httpx.AsyncClient(timeout=40) as client:
            for url in targets:
                if len(pages) >= 8:
                    break
                if progress_callback:
                    keep = await progress_callback(
                        {
                            "current_page": url,
                            "pages_crawled": len(pages),
                            "emails_count": len(all_emails),
                        }
                    )
                    if keep is False:
                        break
                try:
                    resp = await client.post(
                        f"{self._base}/v1/scrape",
                        headers={
                            "Authorization": f"Bearer {key}",
                            "Content-Type": "application/json",
                        },
                        json={"url": url, "formats": ["html", "markdown"]},
                    )
                    if resp.status_code != 200:
                        errors.append(f"Firecrawl HTTP {resp.status_code} on {url}")
                        continue
                    data = resp.json().get("data", {})
                    html = data.get("html") or ""
                    if html:
                        page = http._parse_page(url, 200, html, pre.base_domain)
                        pages.append(page)
                        all_emails.update(page.emails)
                        all_li.update(page.linkedin_urls)
                except Exception as exc:
                    errors.append(f"Firecrawl error on {url}: {exc}")

        result = pre.model_copy()
        if pages:
            result.pages = pages
            result.pages_crawled = len(pages)
        result.all_emails = all_emails
        result.all_linkedin_urls = all_li
        result.engine = "firecrawl"
        result.errors = errors
        result.blocked = False
        result.needs_js = False
        result.duration_seconds = round(_time.time() - start, 2)
        return result


ProviderRegistry.register(FirecrawlProvider())
