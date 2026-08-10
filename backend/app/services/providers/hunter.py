"""
Hunter.io provider (paid, 25 free requests/month).

Capabilities:
  * email_finder – Hunter Domain Search returns *real* addresses found on
    public pages (with source URLs) — never pattern guesses.
  * email_verifier – Hunter Email Verifier.
"""

from typing import List, Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.services.providers.base import (
    CapabilityProvider,
    FoundEmail,
    ProviderRegistry,
    TestResult,
    call_with_timing,
)


class HunterProvider(CapabilityProvider):
    key = "hunter"
    display_name = "Hunter.io Email Finder & Verifier"
    capabilities = ["email_finder", "email_verifier"]
    is_free = False
    requires_api_key = True
    env_key_names = ["HUNTER_API_KEY"]
    signup_url = "https://hunter.io/"

    async def test_connection(self, api_key: Optional[str] = None) -> TestResult:
        key = api_key or settings.HUNTER_API_KEY
        if not key:
            return TestResult(ok=False, message="No API key configured.")
        resp, latency, err = await call_with_timing(
            "GET",
            "https://api.hunter.io/v2/account",
            params={"api_key": key},
        )
        if err:
            return TestResult(
                ok=False, message=f"Request failed: {err}", latency_ms=latency
            )
        assert resp is not None
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            requests = data.get("requests", {})
            searches = requests.get("searches", {})
            return TestResult(
                ok=True,
                message="Connected to Hunter.io.",
                latency_ms=latency,
                details={
                    "plan": data.get("plan_name"),
                    "searches_used": searches.get("used"),
                    "searches_available": searches.get("available"),
                },
            )
        if resp.status_code in (401, 403):
            return TestResult(
                ok=False, message="Invalid Hunter API key.", latency_ms=latency
            )
        return TestResult(
            ok=False,
            message=f"Hunter returned HTTP {resp.status_code}.",
            latency_ms=latency,
        )

    async def find_emails(
        self, domain: str, limit: int = 10, api_key: Optional[str] = None
    ) -> List[FoundEmail]:
        key = api_key or settings.HUNTER_API_KEY
        if not key or not domain:
            return []
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(
                    "https://api.hunter.io/v2/domain-search",
                    params={"domain": domain, "api_key": key, "limit": limit},
                )
            if resp.status_code != 200:
                return []
            out: List[FoundEmail] = []
            for em in resp.json().get("data", {}).get("emails", []):
                sources = em.get("sources", [])
                verified = em.get("verification", {}).get("status") == "valid"
                out.append(
                    FoundEmail(
                        email=(em.get("value") or "").lower().strip(),
                        first_name=em.get("first_name"),
                        last_name=em.get("last_name"),
                        position=em.get("position"),
                        source_url=sources[0].get("uri") if sources else None,
                        provider_verified=verified,
                        provider_score=em.get("confidence"),
                    )
                )
            return out
        except Exception:
            return []

    async def verify(self, email: str, api_key: Optional[str] = None) -> dict:
        key = api_key or settings.HUNTER_API_KEY
        if not key or not email:
            return {"status": "unknown"}
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(
                    "https://api.hunter.io/v2/email-verifier",
                    params={"email": email, "api_key": key},
                )
            if resp.status_code != 200:
                return {"status": "unknown"}
            data = resp.json().get("data", {})
            return {
                "status": data.get("status", "unknown"),  # valid|invalid|accept_all|...
                "score": data.get("score"),
                "mx_records": data.get("mx_records"),
                "smtp_check": data.get("smtp_check"),
            }
        except Exception:
            return {"status": "unknown"}


ProviderRegistry.register(HunterProvider())
