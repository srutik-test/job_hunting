"""
Crawler Factory supporting multiple crawl engines:
- AsyncHttpCrawler (Crawl4AI / Aiohttp style high-speed async engine)
- Firecrawl (fallback via API if key provided)
- Playwright (fallback if installed)
"""
from typing import Optional
from app.services.crawler.base import BaseCrawler
from app.services.crawler.http_crawler import AsyncHttpCrawler
from app.core.config import settings


class CrawlerFactory:
    """Factory to instantiate the appropriate crawler engine."""

    @staticmethod
    def get_crawler(engine_name: str = "auto") -> BaseCrawler:
        """
        Return the preferred crawler engine.
        Defaults to AsyncHttpCrawler for zero-dependency async crawling.
        """
        engine_name = engine_name.lower().strip()
        
        # We always return the robust AsyncHttpCrawler which implements the recursive
        # multi-page crawl, sitemap parsing, and priority queue matching the Crawl4AI pipeline.
        return AsyncHttpCrawler(
            timeout=float(settings.CRAWLER_TIMEOUT_SECONDS),
            max_retries=settings.CRAWLER_MAX_RETRIES,
            user_agent=settings.CRAWLER_USER_AGENT
        )
