"""Provider management endpoints – configuration overview, key storage, tests.

API keys provided through these endpoints are stored encrypted and are never
returned to the frontend (only a masked tail).
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import encrypt_secret, mask_secret
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import APIProvider, User
from app.schemas.domain import ProviderResponse, ProviderTestResponse
from app.services.providers.base import (
    ProviderManager, ProviderRegistry,
)
from app.services.providers import builtin as _builtin  # noqa: F401 - register
from app.services.providers import search as _search  # noqa: F401
from app.services.providers import firecrawl as _firecrawl  # noqa: F401
from app.services.providers import hunter as _hunter  # noqa: F401
from app.services.providers import apollo as _apollo  # noqa: F401

router = APIRouter(prefix="/providers", tags=["Providers"])

CAPABILITIES = ["crawler", "search", "email_finder", "email_verifier", "people"]


async def _user_row(db: AsyncSession, user_id: str, key: str) -> Optional[APIProvider]:
    res = await db.execute(select(APIProvider).where(
        APIProvider.user_id == user_id, APIProvider.provider_key == key))
    return res.scalars().first()


@router.get("", response_model=list[ProviderResponse])
async def list_providers(user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    manager = ProviderManager(db, user.id)
    out: list[ProviderResponse] = []
    for capability in CAPABILITIES:
        active, _key, origin = await manager.resolve(capability)
        for provider in ProviderRegistry.for_capability(capability):
            row = await _user_row(db, user.id, provider.key)
            configured_env = provider.configured_via_env()
            enabled = row.enabled if row else bool(
                configured_env or not provider.requires_api_key)
            status = row.status if row else (
                "connected" if configured_env else
                ("not_tested" if not provider.requires_api_key else "missing_key"))
            out.append(ProviderResponse(
                id=row.id if row else None,
                capability=capability,
                provider_key=provider.key,
                display_name=provider.display_name,
                is_free=provider.is_free,
                configured_via_env=configured_env,
                api_key_masked=row.api_key_masked if row else None,
                has_api_key=bool(row and row.api_key_encrypted) or configured_env,
                enabled=enabled,
                status=status,
                status_detail=row.status_detail if row else (
                    "Configured via environment variable" if configured_env else None),
                last_tested_at=(row.last_tested_at.isoformat()
                                if row and row.last_tested_at else None),
                signup_url=provider.signup_url,
            ))
    return out


class ProviderUpsert(BaseModel):
    api_key: Optional[str] = None      # 'CLEAR' clears the stored key; None keeps it
    enabled: Optional[bool] = None


@router.put("/{provider_key}", response_model=ProviderResponse)
async def upsert_provider(provider_key: str, payload: ProviderUpsert,
                          user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    provider = ProviderRegistry.get(provider_key)
    if provider is None:
        raise HTTPException(status_code=404, detail="Unknown provider.")

    row = await _user_row(db, user.id, provider_key)
    if row is None:
        row = APIProvider(user_id=user.id, capability=provider.capabilities[0],
                          provider_key=provider_key)
        db.add(row)
        await db.flush()

    if payload.api_key == "CLEAR":
        row.api_key_encrypted = None
        row.api_key_masked = None
        row.status = "missing_key"
        row.status_detail = None
    elif payload.api_key:
        raw = payload.api_key.strip()
        if len(raw) < 4 or len(raw) > 512:
            raise HTTPException(status_code=422, detail="API key looks invalid.")
        row.api_key_encrypted = encrypt_secret(raw)
        row.api_key_masked = mask_secret(raw)
        row.status = "not_tested"

    if payload.enabled is not None:
        row.enabled = payload.enabled
    await db.commit()

    return ProviderResponse(
        id=row.id, capability=provider.capabilities[0],
        provider_key=provider.key, display_name=provider.display_name,
        is_free=provider.is_free,
        configured_via_env=provider.configured_via_env(),
        api_key_masked=row.api_key_masked,
        has_api_key=bool(row.api_key_encrypted) or provider.configured_via_env(),
        enabled=row.enabled, status=row.status,
        status_detail=row.status_detail,
        last_tested_at=(row.last_tested_at.isoformat()
                        if row.last_tested_at else None),
        signup_url=provider.signup_url,
    )


class TestRequest(BaseModel):
    api_key: Optional[str] = None  # test an unsaved key without storing it


@router.post("/{provider_key}/test", response_model=ProviderTestResponse)
async def test_provider(provider_key: str, payload: TestRequest,
                        user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    provider = ProviderRegistry.get(provider_key)
    if provider is None:
        raise HTTPException(status_code=404, detail="Unknown provider.")

    api_key = payload.api_key
    row = await _user_row(db, user.id, provider_key)
    if not api_key:
        api_key = await ProviderManager(db, user.id).api_key_for(provider_key)

    if provider.requires_api_key and not api_key:
        return ProviderTestResponse(
            ok=False, provider_key=provider_key,
            message="No API key provided, stored, or configured via environment.",
        )

    try:
        result = await provider.test_connection(api_key)
    except Exception as exc:  # defensive: test must never crash the API
        return ProviderTestResponse(ok=False, provider_key=provider_key,
                                    message=f"Connection test failed: {exc}")

    if row is not None:
        row.status = "connected" if result.ok else "failed"
        row.status_detail = result.message
        row.last_tested_at = datetime.now(timezone.utc)
        await db.commit()

    return ProviderTestResponse(
        ok=result.ok, provider_key=provider_key, message=result.message,
        latency_ms=result.latency_ms, details=result.details,
    )
