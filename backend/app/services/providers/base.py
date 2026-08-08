"""
Provider abstraction layer.

All external capabilities are provided through small interfaces so the
platform never depends on a single vendor:

    Provider Interface
        ├── Website Crawler      (crawl_company -> CrawlResult)
        ├── Search Provider      (search -> [SearchHit])
        ├── Email Finder         (find_emails(domain) -> [FoundEmail])
        ├── Email Verifier       (verify(email) -> VerifyResult)
        └── Professional/Data    (find_people -> [PersonLead])

Providers are registered in PROVIDER_REGISTRY. The ProviderManager resolves
which provider is active for a user by consulting, in order:
  1. the user's enabled DB configuration (API providers settings page),
  2. keys present in environment variables,
  3. a free built-in default for that capability.
"""

import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.models.api_provider import APIProvider
from app.services.crawler.base import CrawlResult


# --------------------------------------------------------------------- shared types
class TestResult(BaseModel):
    ok: bool
    message: str = ""
    latency_ms: int = 0
    details: Dict[str, Any] = {}


class SearchHit(BaseModel):
    title: str = ""
    url: str = ""
    snippet: str = ""


class FoundEmail(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    source_url: Optional[str] = None
    provider_verified: bool = False       # provider states the address is deliverable
    provider_score: Optional[int] = None  # provider's own evidence score if any


class PersonLead(BaseModel):
    name: str
    job_title: str
    linkedin_url: Optional[str] = None
    email: Optional[str] = None
    email_verified: bool = False
    source_url: Optional[str] = None


class CapabilityProvider(ABC):
    """Base class all providers implement."""

    key: str = "abstract"
    display_name: str = "Abstract Provider"
    capabilities: List[str] = []           # crawler|search|email_finder|email_verifier|people
    is_free: bool = False
    requires_api_key: bool = True
    env_key_names: List[str] = []          # env var names checked as fallback config
    signup_url: Optional[str] = None

    def configured_via_env(self) -> bool:
        return any(getattr(settings, n, None) for n in self.env_key_names)

    @abstractmethod
    async def test_connection(self, api_key: Optional[str]) -> TestResult:
        """Actually call the provider API to validate the credentials."""


# --------------------------------------------------------------------- registry
class ProviderRegistry:
    _providers: Dict[str, CapabilityProvider] = {}

    @classmethod
    def register(cls, provider: CapabilityProvider) -> None:
        cls._providers[provider.key] = provider

    @classmethod
    def get(cls, key: str) -> Optional[CapabilityProvider]:
        return cls._providers.get(key)

    @classmethod
    def for_capability(cls, capability: str) -> List[CapabilityProvider]:
        return [p for p in cls._providers.values() if capability in p.capabilities]

    @classmethod
    def all(cls) -> List[CapabilityProvider]:
        return list(cls._providers.values())


# --------------------------------------------------------------------- manager
FREE_DEFAULTS = {
    "crawler": "http_crawler",
    "search": "duckduckgo",
    "email_verifier": "local_mx",
}


class ProviderManager:
    """Resolves active providers per user with graceful fallbacks."""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def _user_config(self, provider_key: str) -> Optional[APIProvider]:
        res = await self.db.execute(
            select(APIProvider).where(
                APIProvider.user_id == self.user_id,
                APIProvider.provider_key == provider_key,
            )
        )
        return res.scalars().first()

    async def resolve(self, capability: str) -> tuple[
        Optional[CapabilityProvider], Optional[str], str]:
        """
        Returns (provider, api_key, origin) where origin is
        'database' | 'environment' | 'free-default' | 'unavailable'.
        """
        candidates = ProviderRegistry.for_capability(capability)

        # 1) enabled user-configured provider with a key
        for provider in candidates:
            cfg = await self._user_config(provider.key)
            if cfg and cfg.enabled:
                key = decrypt_secret(cfg.api_key_encrypted) if cfg.api_key_encrypted else None
                if key or not provider.requires_api_key:
                    return provider, key, "database"

        # 2) environment-configured keys
        for provider in candidates:
            if provider.configured_via_env():
                key = next(
                    (getattr(settings, n) for n in provider.env_key_names
                     if getattr(settings, n, None)), None
                )
                return provider, key, "environment"

        # 3) free default
        default_key = FREE_DEFAULTS.get(capability)
        if default_key:
            provider = ProviderRegistry.get(default_key)
            if provider and capability in provider.capabilities and not provider.requires_api_key:
                return provider, None, "free-default"

        return None, None, "unavailable"

    async def api_key_for(self, provider_key: str) -> Optional[str]:
        cfg = await self._user_config(provider_key)
        if cfg and cfg.api_key_encrypted:
            key = decrypt_secret(cfg.api_key_encrypted)
            if key:
                return key
        provider = ProviderRegistry.get(provider_key)
        if provider:
            return next(
                (getattr(settings, n) for n in provider.env_key_names
                 if getattr(settings, n, None)), None
            )
        return None


# --------------------------------------------------------------------- HTTP helpers
async def call_with_timing(method: str, url: str, **kwargs) -> tuple[Optional[httpx.Response], int, Optional[str]]:
    """HTTP helper used by provider test-connection implementations."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.request(method, url, **kwargs)
        latency = int((time.monotonic() - start) * 1000)
        return resp, latency, None
    except Exception as exc:
        latency = int((time.monotonic() - start) * 1000)
        return None, latency, str(exc)
