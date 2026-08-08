"""
Apollo.io professional data provider (paid, free tier available).

Used for legitimate LinkedIn-adjacent discovery: HR/recruitment people
working at the target company. Only data returned by the Apollo API is
surfaced; nothing is fabricated.
"""

from typing import List, Optional

import httpx

from app.core.config import settings
from app.services.providers.base import (
    CapabilityProvider, PersonLead, ProviderRegistry, TestResult, call_with_timing,
)

HR_TITLES = [
    "hr manager", "human resources manager", "head of hr", "hr director",
    "recruiter", "talent acquisition manager", "talent acquisition specialist",
    "talent partner", "recruitment manager", "hr business partner",
    "people operations manager", "hr executive",
]


class ApolloProvider(CapabilityProvider):
    key = "apollo"
    display_name = "Apollo.io People Data"
    capabilities = ["people"]
    is_free = False
    requires_api_key = True
    env_key_names = ["APOLLO_API_KEY"]
    signup_url = "https://www.apollo.io/"

    @property
    def _base(self) -> str:
        return settings.APOLLO_BASE_URL.rstrip("/")

    async def test_connection(self, api_key: Optional[str] = None) -> TestResult:
        key = api_key or settings.APOLLO_API_KEY
        if not key:
            return TestResult(ok=False, message="No API key configured.")
        resp, latency, err = await call_with_timing(
            "GET", f"{self._base}/v1/auth/health",
            headers={"X-Api-Key": key},
        )
        if err:
            return TestResult(ok=False, message=f"Request failed: {err}",
                              latency_ms=latency)
        assert resp is not None
        if resp.status_code == 200 and resp.json().get("is_logged_in"):
            return TestResult(ok=True, message="Connected to Apollo.io.",
                              latency_ms=latency)
        return TestResult(ok=False, message="Invalid Apollo API key.",
                          latency_ms=latency)

    async def find_people(self, company_domain: str, company_name: str = "",
                          limit: int = 5,
                          api_key: Optional[str] = None) -> List[PersonLead]:
        key = api_key or settings.APOLLO_API_KEY
        if not key or not company_domain:
            return []
        people: List[PersonLead] = []
        seen_names = set()
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                for title in HR_TITLES[:4]:
                    resp = await client.post(
                        f"{self._base}/v1/mixed_people/search",
                        headers={"X-Api-Key": key, "Content-Type": "application/json"},
                        json={
                            "person_titles": [title],
                            "q_organization_domains": company_domain,
                            "per_page": 3,
                            "page": 1,
                        },
                    )
                    if resp.status_code != 200:
                        break
                    for p in resp.json().get("people", []):
                        name = p.get("name") or ""
                        if not name or name.lower() in seen_names:
                            continue
                        seen_names.add(name.lower())
                        emails = p.get("email")  # Apollo only returns emails within plan
                        people.append(PersonLead(
                            name=name,
                            job_title=p.get("title") or title.title(),
                            linkedin_url=p.get("linkedin_url"),
                            email=(emails or "").lower() or None,
                            email_verified=bool(
                                emails and p.get("email_status") in
                                ("verified", "guessed" if False else "verified")
                            ),
                            source_url=f"{self._base} people search",
                        ))
                    if len(people) >= limit:
                        return people
        except Exception:
            return people
        return people


ProviderRegistry.register(ApolloProvider())
