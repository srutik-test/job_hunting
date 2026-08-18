"""
Apollo.io professional data provider (paid, free tier available).

Used for legitimate LinkedIn-adjacent discovery: HR/recruitment people
working at the target company. Only data returned by the Apollo API is
surfaced; nothing is fabricated.
"""

from typing import List, Optional
import logging

import httpx

from app.core.config import settings
from app.services.providers.base import (
    CapabilityProvider,
    PersonLead,
    ProviderRegistry,
    TestResult,
    call_with_timing,
)

logger = logging.getLogger("platform.providers.apollo")

HR_TITLES = [
    "HR Manager",
    "Human Resources Manager",
    "Head of HR",
    "HR Director",
    "Recruiter",
    "Talent Acquisition Manager",
    "Talent Acquisition Specialist",
    "Talent Partner",
    "Recruitment Manager",
    "HR Business Partner",
    "People Operations Manager",
    "HR Executive",
    "Technical Recruiter",
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
            "GET",
            f"{self._base}/v1/auth/health",
            headers={"X-Api-Key": key},
        )
        if err:
            return TestResult(
                ok=False, message=f"Request failed: {err}", latency_ms=latency
            )
        assert resp is not None
        if resp.status_code == 200 and resp.json().get("is_logged_in"):
            return TestResult(
                ok=True, message="Connected to Apollo.io.", latency_ms=latency
            )
        return TestResult(
            ok=False, message="Invalid Apollo API key.", latency_ms=latency
        )

    async def find_people(
        self,
        company_domain: str,
        company_name: str = "",
        limit: int = 10,
        api_key: Optional[str] = None,
    ) -> List[PersonLead]:
        key = api_key or settings.APOLLO_API_KEY
        if not key or not company_domain:
            return []
        
        domain_clean = company_domain.lower().strip().removeprefix("www.")
        people: List[PersonLead] = []
        seen_names = set()

        try:
            async with httpx.AsyncClient(timeout=25) as client:
                payload = {
                    "person_titles": HR_TITLES,
                    "q_organization_domains": domain_clean,
                    "per_page": limit,
                    "page": 1,
                }
                resp = await client.post(
                    f"{self._base}/v1/organizations/search",
                    headers={"X-Api-Key": key, "Content-Type": "application/json"},
                    json=payload,
                )
                if resp.status_code != 200:
                    logger.warning(
                        "Apollo search returned HTTP %s for domain %s: %s",
                        resp.status_code,
                        domain_clean,
                        resp.text[:300],
                    )
                    return []

                data = resp.json()
                raw_people = data.get("people", [])
                for p in raw_people:
                    name = p.get("name") or f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
                    if not name or name.lower() in seen_names:
                        continue
                    seen_names.add(name.lower())
                    email = (p.get("email") or "").strip().lower() or None
                    people.append(
                        PersonLead(
                            name=name,
                            job_title=p.get("title") or "HR Professional",
                            linkedin_url=p.get("linkedin_url"),
                            email=email,
                            email_verified=bool(
                                email and p.get("email_status") in ("verified", "extrapolated")
                            ),
                            source_url=f"https://app.apollo.io/#/people?qOrganizationDomain={domain_clean}",
                        )
                    )
                    if len(people) >= limit:
                        break
        except Exception as exc:
            logger.exception("Error querying Apollo for domain %s: %s", domain_clean, exc)
            return people

        return people


ProviderRegistry.register(ApolloProvider())
