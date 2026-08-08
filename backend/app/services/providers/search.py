"""Search providers: DuckDuckGo (free) and Google Custom Search (paid)."""

import re
from typing import Optional

import httpx

from app.core.config import settings
from app.services.providers.base import (
    CapabilityProvider, ProviderRegistry, SearchHit, TestResult, call_with_timing,
)


class DuckDuckGoSearchProvider(CapabilityProvider):
    """Free public search via DuckDuckGo HTML (public snippets only)."""

    key = "duckduckgo"
    display_name = "DuckDuckGo Public Search (free)"
    capabilities = ["search"]
    is_free = True
    requires_api_key = False
    signup_url = "https://html.duckduckgo.com/"

    async def test_connection(self, api_key=None) -> TestResult:
        resp, latency, err = await call_with_timing(
            "GET", "https://html.duckduckgo.com/html/?q=test",
            headers={"User-Agent": settings.CRAWLER_USER_AGENT},
        )
        if err:
            return TestResult(ok=False, message=f"DuckDuckGo unreachable: {err}",
                              latency_ms=latency)
        if resp is not None and resp.status_code < 400:
            return TestResult(ok=True, message="DuckDuckGo reachable.",
                              latency_ms=latency)
        return TestResult(ok=False,
                          message=f"DuckDuckGo returned HTTP "
                                  f"{resp.status_code if resp else '?'}",
                          latency_ms=latency)

    async def search(self, query: str, max_results: int = 8) -> list[SearchHit]:
        hits: list[SearchHit] = []
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": query},
                    headers={"User-Agent": settings.CRAWLER_USER_AGENT},
                )
            if resp.status_code >= 400:
                return hits
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(resp.text, "lxml")
            for res in soup.select(".result"):
                a = res.select_one(".result__a")
                snippet = res.select_one(".result__snippet")
                if not a:
                    continue
                url = a.get("href", "")
                # DDG wraps URLs in a redirect – extract uddg
                m = re.search(r"[?&]uddg=([^&]+)", url)
                if m:
                    from urllib.parse import unquote
                    url = unquote(m.group(1))
                title = a.get_text(strip=True)
                text = snippet.get_text(" ", strip=True) if snippet else ""
                if title and url.startswith("http"):
                    hits.append(SearchHit(title=title, url=url, snippet=text))
                if len(hits) >= max_results:
                    break
        except Exception:
            return hits
        return hits


class GoogleCustomSearchProvider(CapabilityProvider):
    """Google Programmable Search Engine (paid quota, 100 free queries/day)."""

    key = "google_search"
    display_name = "Google Custom Search API"
    capabilities = ["search"]
    is_free = False
    requires_api_key = True
    env_key_names = ["GOOGLE_SEARCH_API_KEY"]
    signup_url = "https://programmablesearchengine.google.com/"

    def configured_via_env(self) -> bool:
        return bool(settings.GOOGLE_SEARCH_API_KEY and settings.GOOGLE_SEARCH_ENGINE_ID)

    async def test_connection(self, api_key=None) -> TestResult:
        key = api_key or settings.GOOGLE_SEARCH_API_KEY
        cx = settings.GOOGLE_SEARCH_ENGINE_ID
        if not key:
            return TestResult(ok=False, message="No API key configured.")
        if not cx:
            return TestResult(ok=False,
                              message="GOOGLE_SEARCH_ENGINE_ID is not configured.")
        resp, latency, err = await call_with_timing(
            "GET", "https://www.googleapis.com/customsearch/v1",
            params={"key": key, "cx": cx, "q": "connection test", "num": 1},
        )
        if err:
            return TestResult(ok=False, message=f"Request failed: {err}",
                              latency_ms=latency)
        assert resp is not None
        if resp.status_code == 200:
            info = resp.json().get("queries", {}).get("request", [])
            return TestResult(ok=True, message="Connected to Google Custom Search.",
                              latency_ms=latency,
                              details={"results_found":
                                       resp.json().get("searchInformation", {}).get(
                                           "totalResults")})
        reason = ""
        try:
            reason = resp.json().get("error", {}).get("message", "")
        except Exception:
            pass
        return TestResult(ok=False,
                          message=reason or f"HTTP {resp.status_code}",
                          latency_ms=latency)

    async def search(self, query: str, max_results: int = 8,
                     api_key: Optional[str] = None) -> list[SearchHit]:
        key = api_key or settings.GOOGLE_SEARCH_API_KEY
        cx = settings.GOOGLE_SEARCH_ENGINE_ID
        if not key or not cx:
            return []
        hits: list[SearchHit] = []
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={"key": key, "cx": cx, "q": query,
                            "num": min(max_results, 10)},
                )
            if resp.status_code != 200:
                return hits
            for item in resp.json().get("items", []):
                hits.append(SearchHit(
                    title=item.get("title", ""), url=item.get("link", ""),
                    snippet=item.get("snippet", ""),
                ))
        except Exception:
            return hits
        return hits


ProviderRegistry.register(DuckDuckGoSearchProvider())
ProviderRegistry.register(GoogleCustomSearchProvider())
