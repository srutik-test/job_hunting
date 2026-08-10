"""Built-in free providers: HTTP crawler, optional Playwright crawler, MX verifier."""

from app.core.config import settings
from app.services.crawler.http_crawler import HttpCrawler
from app.services.providers.base import (
    CapabilityProvider,
    ProviderRegistry,
    TestResult,
)
from app.services.verification.email_verifier import (
    VerificationLevel,
    verify_email_local,
    mx_records,
)


class HttpCrawlerProvider(CapabilityProvider):
    key = "http_crawler"
    display_name = "Built-in HTTP Crawler (free)"
    capabilities = ["crawler"]
    is_free = True
    requires_api_key = False

    async def test_connection(self, api_key=None) -> TestResult:
        return TestResult(
            ok=True,
            message="Built-in crawler available (no API key required).",
            latency_ms=0,
            details={"max_pages": settings.CRAWLER_MAX_PAGES_PER_COMPANY},
        )

    async def crawl_company(self, base_url, company_name="", progress_callback=None):
        crawler = HttpCrawler(
            timeout=settings.CRAWLER_TIMEOUT_SECONDS,
            max_pages=settings.CRAWLER_MAX_PAGES_PER_COMPANY,
        )
        return await crawler.crawl_company(base_url, company_name, progress_callback)


class PlaywrightCrawlerProvider(CapabilityProvider):
    key = "playwright"
    display_name = "Browser Crawler – Playwright (free, optional)"
    capabilities = ["crawler"]
    is_free = True
    requires_api_key = False
    signup_url = "https://playwright.dev/python/"

    def available(self) -> bool:
        from app.services.crawler.browser_crawler import is_available

        return is_available()

    async def test_connection(self, api_key=None) -> TestResult:
        if not self.available():
            return TestResult(
                ok=False,
                message="Playwright is not installed/enabled. Install with "
                "`pip install playwright && playwright install chromium` and set "
                "ENABLE_PLAYWRIGHT=true.",
            )
        return TestResult(
            ok=True,
            message="Playwright Chromium crawler available.",
            details={"max_pages": settings.PLAYWRIGHT_MAX_PAGES},
        )

    async def crawl_company(self, base_url, company_name="", progress_callback=None):
        from app.services.crawler.browser_crawler import BrowserCrawler

        return await BrowserCrawler().crawl_company(
            base_url, company_name, progress_callback
        )


class LocalMxVerifierProvider(CapabilityProvider):
    key = "local_mx"
    display_name = "Built-in MX/DNS Verifier (free)"
    capabilities = ["email_verifier"]
    is_free = True
    requires_api_key = False

    async def test_connection(self, api_key=None) -> TestResult:
        try:
            hosts = await mx_records("gmail.com")
            if hosts:
                return TestResult(
                    ok=True,
                    message="DNS resolution working (MX lookup succeeded).",
                    details={"sample_mx": hosts[:2]},
                )
            return TestResult(
                ok=False, message="DNS available but MX lookup returned no results."
            )
        except Exception as exc:
            return TestResult(
                ok=False,
                message=f"DNS resolution failed: {exc}. Verification will "
                "fall back to syntax-only checks.",
            )

    async def verify(self, email: str) -> VerificationLevel:
        return await verify_email_local(email)


ProviderRegistry.register(HttpCrawlerProvider())
ProviderRegistry.register(PlaywrightCrawlerProvider())
ProviderRegistry.register(LocalMxVerifierProvider())
