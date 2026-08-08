"""
Sitemap and Robots.txt parser.
Extracts direct public URLs for careers, jobs, and contact pages from XML sitemaps.
"""
import re
import xml.etree.ElementTree as ET
from typing import List, Set
from urllib.parse import urljoin, urlparse
import httpx
from app.services.crawler.page_classifier import get_url_crawl_priority


class SitemapParser:
    """Async sitemap and robots.txt explorer."""

    def __init__(self, timeout: float = 10.0, user_agent: str = ""):
        self.timeout = timeout
        self.headers = {"User-Agent": user_agent or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    async def discover_sitemap_urls(self, base_url: str, client: httpx.AsyncClient) -> List[str]:
        """Discover candidate high-priority URLs from sitemap.xml and robots.txt."""
        discovered_urls: Set[str] = set()
        sitemap_locations = [
            urljoin(base_url, "/sitemap.xml"),
            urljoin(base_url, "/sitemap_index.xml"),
            urljoin(base_url, "/sitemap-main.xml"),
            urljoin(base_url, "/sitemap/sitemap.xml"),
            urljoin(base_url, "/robots.txt"),
        ]

        for sitemap_url in sitemap_locations:
            try:
                resp = await client.get(sitemap_url, headers=self.headers, timeout=self.timeout, follow_redirects=True)
                if resp.status_code != 200:
                    continue

                content = resp.text

                # If robots.txt, parse Sitemap: directives
                if sitemap_url.endswith("robots.txt"):
                    for line in content.splitlines():
                        if line.lower().startswith("sitemap:"):
                            s_url = line.split(":", 1)[1].strip()
                            if s_url and s_url.startswith("http"):
                                sub_urls = await self._parse_xml_sitemap(s_url, client)
                                discovered_urls.update(sub_urls)
                    continue

                # Parse XML sitemap
                urls = self._extract_urls_from_xml(content, base_url)
                discovered_urls.update(urls)

                # If we found relevant pages, break early
                if len(discovered_urls) >= 50:
                    break
            except Exception:
                continue

        # Filter & sort by priority
        prioritized = []
        for url in discovered_urls:
            prio = get_url_crawl_priority(url)
            if prio > 0:
                prioritized.append((prio, url))

        # Sort descending by priority
        prioritized.sort(key=lambda x: x[0], reverse=True)
        return [url for _, url in prioritized[:30]]

    async def _parse_xml_sitemap(self, sitemap_url: str, client: httpx.AsyncClient) -> Set[str]:
        """Fetch and parse sub-sitemap."""
        try:
            resp = await client.get(sitemap_url, headers=self.headers, timeout=self.timeout, follow_redirects=True)
            if resp.status_code == 200:
                return self._extract_urls_from_xml(resp.text, sitemap_url)
        except Exception:
            pass
        return set()

    def _extract_urls_from_xml(self, xml_content: str, base_url: str) -> Set[str]:
        """Parse XML string or use regex fallback for malformed XML."""
        urls: Set[str] = set()
        try:
            # Strip namespaces for easier XPath
            cleaned_xml = re.sub(r'xmlns="[^"]+"', '', xml_content, count=1)
            root = ET.fromstring(cleaned_xml)

            # Check for <url><loc>
            for loc in root.findall(".//url/loc"):
                if loc.text:
                    urls.add(loc.text.strip())

            # Check for <sitemap><loc> (sitemap index)
            for loc in root.findall(".//sitemap/loc"):
                if loc.text:
                    # Note: could be nested sitemap
                    urls.add(loc.text.strip())
        except Exception:
            # Fallback regex
            loc_matches = re.findall(r'<loc>(https?://[^<]+)</loc>', xml_content, re.IGNORECASE)
            for m in loc_matches:
                urls.add(m.strip())

        return urls
