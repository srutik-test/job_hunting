"""Sitemap + robots.txt discovery helpers."""

import re
import xml.etree.ElementTree as ET
from typing import List, Set

import httpx

from app.services.crawler.page_classifier import get_url_crawl_priority


class SitemapParser:
    def __init__(self, timeout: float = 10.0, user_agent: str = ""):
        self.timeout = timeout
        self.headers = {
            "User-Agent": user_agent or "HR-Contact-Research/2.0",
        }

    async def discover_sitemap_urls(
        self, base_url: str, client: httpx.AsyncClient
    ) -> tuple[List[str], bool]:
        """Return (prioritised urls, sitemap_found)."""
        discovered: Set[str] = set()
        sitemap_found = False
        locations = [
            f"{base_url}/sitemap.xml",
            f"{base_url}/sitemap_index.xml",
            f"{base_url}/robots.txt",
        ]

        for loc in locations:
            try:
                resp = await client.get(
                    loc,
                    headers=self.headers,
                    timeout=self.timeout,
                    follow_redirects=True,
                )
                if resp.status_code != 200:
                    continue
                if loc.endswith("robots.txt"):
                    for line in resp.text.splitlines():
                        if line.lower().startswith("sitemap:"):
                            s_url = line.split(":", 1)[1].strip()
                            if s_url.startswith("http"):
                                sub = await self._fetch_xml(s_url, client)
                                if sub:
                                    sitemap_found = True
                                discovered.update(sub)
                    continue
                urls = self._extract_urls(resp.text)
                if urls:
                    sitemap_found = True
                discovered.update(urls)
                if len(discovered) >= 50:
                    break
            except Exception:
                continue

        prioritised = sorted(
            ((get_url_crawl_priority(u), u) for u in discovered),
            key=lambda x: x[0],
            reverse=True,
        )
        return [u for p, u in prioritised if p > 0][:30], sitemap_found

    async def _fetch_xml(self, url: str, client: httpx.AsyncClient) -> Set[str]:
        try:
            resp = await client.get(
                url, headers=self.headers, timeout=self.timeout, follow_redirects=True
            )
            if resp.status_code == 200:
                return self._extract_urls(resp.text)
        except Exception:
            pass
        return set()

    @staticmethod
    def _extract_urls(xml_content: str) -> Set[str]:
        urls: Set[str] = set()
        try:
            cleaned = re.sub(r'xmlns="[^"]+"', "", xml_content, count=1)
            root = ET.fromstring(cleaned)
            for loc in root.findall(".//url/loc") + root.findall(".//sitemap/loc"):
                if loc.text:
                    urls.add(loc.text.strip())
        except Exception:
            for m in re.findall(r"<loc>(https?://[^<]+)</loc>", xml_content, re.I):
                urls.add(m.strip())
        return urls
