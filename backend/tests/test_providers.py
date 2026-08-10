"""Provider registry/selection tests + API-key security tests."""

import pytest

from app.services.providers.base import (
    FREE_DEFAULTS,
    ProviderManager,
    ProviderRegistry,
)


def test_registry_has_all_capabilities():
    for capability in ("crawler", "search", "email_finder", "email_verifier", "people"):
        providers = ProviderRegistry.for_capability(capability)
        assert providers, f"no provider registered for {capability}"


def test_free_defaults_exist():
    for capability, key in FREE_DEFAULTS.items():
        provider = ProviderRegistry.get(key)
        assert provider is not None
        assert capability in provider.capabilities
        assert provider.is_free
        assert not provider.requires_api_key


def test_providers_have_test_connection():
    for provider in ProviderRegistry.all():
        assert hasattr(provider, "test_connection")
        assert provider.display_name
        assert provider.capabilities


@pytest.mark.asyncio
async def test_builtin_test_connections_pass(client):
    ac, Session = client
    for key in ("http_crawler",):
        provider = ProviderRegistry.get(key)
        result = await provider.test_connection(None)
        assert result.ok, f"{key} test failed: {result.message}"


@pytest.mark.asyncio
async def test_manager_resolves_free_defaults(client):
    ac, Session = client
    from tests.conftest import register_and_verify

    user = await register_and_verify(ac, Session)
    async with Session() as db:
        manager = ProviderManager(db, user["id"])
        crawler, key, origin = await manager.resolve("crawler")
        assert crawler is not None and origin == "free-default"
        verifier, _, origin = await manager.resolve("email_verifier")
        assert verifier is not None and origin == "free-default"
        search, _, origin = await manager.resolve("search")
        assert search is not None and origin == "free-default"
        # no email finder without a key
        finder, _, origin = await manager.resolve("email_finder")
        assert finder is None and origin == "unavailable"


@pytest.mark.asyncio
async def test_api_key_storage_is_encrypted_and_masked(client):
    ac, Session = client
    from tests.conftest import register_and_verify

    user = await register_and_verify(ac, Session)

    resp = await ac.put(
        "/api/v1/providers/hunter",
        json={
            "api_key": "super-secret-hunter-key-123",
            "enabled": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_api_key"] is True
    assert "super-secret" not in str(data)
    assert data["api_key_masked"].endswith("-123")

    # DB stores only ciphertext
    from app.models import APIProvider
    from sqlalchemy import select

    async with Session() as db:
        res = await db.execute(select(APIProvider))
        row = res.scalars().first()
        assert "super-secret" not in (row.api_key_encrypted or "")

        # decryption round-trips for internal use
        manager = ProviderManager(db, user["id"])
        assert await manager.api_key_for("hunter") == "super-secret-hunter-key-123"

    # provider list never leaks the key
    resp = await ac.get("/api/v1/providers")
    assert resp.status_code == 200
    assert "super-secret" not in resp.text


@pytest.mark.asyncio
async def test_test_connection_no_key_reports_missing(client):
    ac, Session = client
    from tests.conftest import register_and_verify

    await register_and_verify(ac, Session)
    resp = await ac.post("/api/v1/providers/hunter/test", json={})
    assert resp.status_code == 200
    assert resp.json()["ok"] is False
    assert "no api key" in resp.json()["message"].lower()
