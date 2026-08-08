"""
DuckDuckGo Public Search Service.
Searches public indexes for company career pages, public HR emails, and public LinkedIn HR profiles.
"""
import asyncio
import re
from typing import List, Dict, Any, Optional
from duckduckgo_search import DDGS
from app.core.config import settings
from app.services.extractor.linkedin_finder import LinkedInFinder, PublicHRProfile
from app.services.extractor.email_classifier import EMAIL_REGEX, classify_email, CategorizedEmail


class PublicSearchEngine:
    """Performs targeted public OSINT searches for company HR info."""

    def __init__(self, delay_seconds: float = 1.0):
        self.delay_seconds = delay_seconds

    async def search_company_hr_info(
        self,
        company_name: str,
        website_domain: str,
        max_results: int = 8
    ) -> Dict[str, Any]:
        """
        Execute multi-angle public search queries:
        1. Site-specific careers & HR email search
        2. Public LinkedIn HR & Recruiter search
        3. Public Directory search
        """
        discovered_emails: List[CategorizedEmail] = []
        discovered_profiles: List[PublicHRProfile] = []
        searched_queries = []

        if not settings.ENABLE_SEARCH_ENGINE:
            return {
                "emails": discovered_emails,
                "profiles": discovered_profiles,
                "queries": searched_queries
            }

        # Query 1: Public LinkedIn HR profiles for company
        query_linkedin = f'site:linkedin.com/in "{company_name}" ("HR Manager" OR "Recruiter" OR "Talent Acquisition" OR "HR Executive" OR "People Operations")'
        searched_queries.append(query_linkedin)
        linkedin_results = await self._run_ddg_query(query_linkedin, max_results=max_results)

        for res in linkedin_results:
            title = res.get("title", "")
            snippet = res.get("body", "")
            url = res.get("href", "")

            profile = LinkedInFinder.parse_public_search_snippet(
                title=title,
                snippet=snippet,
                profile_url=url,
                company_name=company_name
            )
            if profile:
                discovered_profiles.append(profile)

        await asyncio.sleep(self.delay_seconds)

        # Query 2: Public email discovery on domains
        if website_domain:
            clean_domain = website_domain.replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "")
            query_emails = f'site:{clean_domain} ("careers" OR "hr@" OR "recruitment@" OR "jobs@" OR "talent@")'
            searched_queries.append(query_emails)
            email_results = await self._run_ddg_query(query_emails, max_results=max_results)

            for res in email_results:
                text_to_scan = f"{res.get('title', '')} {res.get('body', '')}"
                found_emails = EMAIL_REGEX.findall(text_to_scan)
                for em in found_emails:
                    clean_em = em.strip().lower().rstrip(".,;:'\"")
                    if clean_domain in clean_em or "@" in clean_em:
                        cat_em = classify_email(clean_em, page_type="careers", source_url=res.get("href", "Search Result"))
                        discovered_emails.append(cat_em)

        await asyncio.sleep(self.delay_seconds)

        # Query 3: Directory and Public Registry search (Apollo/Wellfound/Clutch snippets)
        query_directory = f'"{company_name}" ("recruitment email" OR "HR email" OR "careers contact")'
        searched_queries.append(query_directory)
        dir_results = await self._run_ddg_query(query_directory, max_results=5)

        for res in dir_results:
            text_to_scan = f"{res.get('title', '')} {res.get('body', '')}"
            found_emails = EMAIL_REGEX.findall(text_to_scan)
            for em in found_emails:
                clean_em = em.strip().lower().rstrip(".,;:'\"")
                cat_em = classify_email(clean_em, page_type="careers", source_url=res.get("href", "Public Directory"))
                discovered_emails.append(cat_em)

        return {
            "emails": discovered_emails,
            "profiles": discovered_profiles,
            "queries": searched_queries
        }

    async def _run_ddg_query(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """Run DuckDuckGo text query in async executor with error handling."""
        def _sync_search():
            try:
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=max_results))
            except Exception:
                return []

        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(None, _sync_search)
            return results
        except Exception:
            return []
