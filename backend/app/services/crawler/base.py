"""
Base Crawler abstract interface.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Set, Any, Optional
from pydantic import BaseModel


class CrawledPage(BaseModel):
    url: str
    status_code: int
    title: str = ""
    text_content: str = ""
    html_content: str = ""
    links: List[str] = []
    page_type: str = "general"  # careers, contact, team, leadership, sitemap, privacy, general
    discovered_emails: List[str] = []
    discovered_linkedin_urls: List[str] = []
    meta_description: str = ""
    json_ld_data: List[Dict[str, Any]] = []


class CrawlResult(BaseModel):
    base_url: str
    pages_crawled: int
    pages: List[CrawledPage] = []
    all_emails: Set[str] = set()
    all_linkedin_urls: Set[str] = set()
    sitemap_found: bool = False
    duration_seconds: float = 0.0
    errors: List[str] = []

    model_config = {"arbitrary_types_allowed": True}


class BaseCrawler(ABC):
    """Abstract interface for web crawlers."""

    @abstractmethod
    async def crawl_company(
        self,
        base_url: str,
        company_name: str,
        max_pages: int = 25,
        progress_callback: Optional[Any] = None
    ) -> CrawlResult:
        """Recursively crawl the target company website."""
        pass
