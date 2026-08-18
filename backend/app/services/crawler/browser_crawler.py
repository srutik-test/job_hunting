"""
Optional browser-based crawler using Playwright (Chromium).

Only active when:
  * the optional `playwright` package is installed (`pip install playwright`
    and `playwright install chromium`), and
  * ENABLE_PLAYWRIGHT=true.

If Playwright is unavailable, `is_available()` reports False and the
orchestrator transparently falls back to other providers (e.g. Firecrawl).
"""

from typing import Any, Awaitable, Callable, Dict, List, Optional, Set

from app.core.config import settings
from app.services.crawler.base import CrawlResult
from app.services.crawler.http_crawler import HttpCrawler

ProgressCallback = Optional[Callable[[Dict[str, Any]], Awaitable[Optional[bool]]]]


def is_available() -> bool:
    try:
        import playwright  # noqa: F401

        return bool(settings.ENABLE_PLAYWRIGHT)
    except ImportError:
        return False


class BrowserCrawler:
    """
    Renders JavaScript-heavy pages in headless Chromium and extracts the
    same fields as the lightweight HTTP crawler.
    """

    engine = "playwright"

    def __init__(self, max_pages: Optional[int] = None):
        self.max_pages = max_pages or settings.PLAYWRIGHT_MAX_PAGES
        self.http = HttpCrawler(max_pages=self.max_pages)

    async def crawl_company(
        self,
        base_url: str,
        company_name: str = "",
        progress_callback: ProgressCallback = None,
    ) -> CrawlResult:
        from playwright.async_api import async_playwright  # local import

        result: Optional[CrawlResult] = None
        async with async_playwright() as pw:  # pragma: no cover - needs browser
            browser = await pw.chromium.launch(headless=True)
            try:
                context = await browser.new_context(
                    user_agent=settings.CRAWLER_USER_AGENT
                )
                page = await context.new_page()
                # Re-use the HTTP crawl to identify relevant URLs, then render
                # the ones that looked JS-heavy.
                html_pages: List[str] = []
                seen: Set[str] = set()
                pre = await self.http.crawl_company(
                    base_url, company_name, progress_callback=None
                )
                targets = [p.url for p in pre.pages[: self.max_pages]]
                if base_url not in targets:
                    targets.insert(0, base_url)

                import time as _time

                start = _time.time()
                pages = []
                for url in targets[: self.max_pages]:
                    if url in seen:
                        continue
                    seen.add(url)
                    if progress_callback:
                        keep = await progress_callback(
                            {
                                "current_page": url,
                                "pages_crawled": len(pages),
                                "emails_count": len(pre.all_emails),
                            }
                        )
                        if keep is False:
                            break
                    try:
                        await page.goto(
                            url,
                            wait_until="networkidle",
                            timeout=int(self.http.timeout * 1000),
                        )
                        # Scroll down to bottom to trigger lazy-loaded footers and dynamic contact components
                        try:
                            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await page.wait_for_timeout(600)
                            await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                            await page.wait_for_timeout(300)
                            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await page.wait_for_timeout(600)
                        except Exception:
                            pass
                        html = await page.content()
                        parsed = self.http._parse_page(url, 200, html, pre.base_domain)
                        pages.append(parsed)
                        html_pages.append(url)
                    except Exception as exc:  # pragma: no cover
                        pre.errors.append(f"Browser render failed on {url}: {exc}")

                if pages:
                    result = pre.model_copy()
                    result.pages = pages
                    result.pages_crawled = len(pages)
                    all_em = set(pre.all_emails)
                    all_ph = set(pre.all_phones)
                    all_li = set(pre.all_linkedin_urls)
                    for p in pages:
                        all_em.update(p.emails)
                        all_ph.update(p.phones)
                        all_li.update(p.linkedin_urls)
                    result.all_emails = all_em
                    result.all_phones = all_ph
                    result.all_linkedin_urls = all_li
                    result.needs_js = False
                    result.engine = self.engine
                    result.duration_seconds = round(_time.time() - start, 2)
            finally:
                await browser.close()

        if result is None:
            result = await self.http.crawl_company(
                base_url, company_name, progress_callback
            )
            result.engine = self.engine
        return result
