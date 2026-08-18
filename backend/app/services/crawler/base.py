"""Crawler data structures shared by all crawl providers."""

from typing import Dict, List, Set, Any
from pydantic import BaseModel


class CrawledPage(BaseModel):
    url: str
    status_code: int
    title: str = ""
    text_content: str = ""
    html_content: str = ""
    links: List[str] = []
    page_type: str = "general"
    emails: List[str] = []
    phones: List[str] = []
    linkedin_urls: List[str] = []
    meta_description: str = ""
    json_ld: List[Any] = []
    # emails paired with their surrounding text context (for HR classification)
    email_contexts: List[Dict[str, str]] = []


class CrawlResult(BaseModel):
    base_url: str
    base_domain: str = ""
    pages: List[CrawledPage] = []
    pages_crawled: int = 0
    all_emails: Set[str] = set()
    all_phones: Set[str] = set()
    all_linkedin_urls: Set[str] = set()
    sitemap_found: bool = False
    robots_disallowed: int = 0
    needs_js: bool = False  # light crawl suggests JS rendering is required
    blocked: bool = False  # anti-bot protection detected (e.g. Cloudflare)
    blocked_reason: str = ""
    duration_seconds: float = 0.0
    errors: List[str] = []
    engine: str = "http"  # http | playwright | firecrawl

    model_config = {"arbitrary_types_allowed": True}
