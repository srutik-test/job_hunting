"""Shared pytest fixtures: fresh database + test client, no external network."""

import asyncio
import os
import sys
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Test environment: disabled CAPTCHA, fast rate limits, no public search calls.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["DEBUG"] = "true"
os.environ["CAPTCHA_PROVIDER"] = "none"
os.environ["ENABLE_PUBLIC_SEARCH"] = "false"
os.environ["ENABLE_SMTP_VERIFICATION"] = "false"
os.environ["RATE_LIMIT_AUTH"] = "10000/minute"
os.environ["RATE_LIMIT_SEARCH"] = "10000/minute"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
settings.SMTP_HOST = None
settings.SMTP_FROM = "no-reply@hr-platform.local"
settings.DEBUG = True

from app.core.database import Base, get_db  # noqa: E402
from app import models  # noqa: F401, E402
from app.main import app  # noqa: E402
import app.services.worker as worker_module  # noqa: E402

TEST_EMAIL = "tester@example.com"


TEST_PASSWORD = "Sup3rSecret!"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def client(tmp_path) -> AsyncGenerator:
    db_path = tmp_path / "test.db"
    url = f"sqlite+aiosqlite:///{db_path}"
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db
    # Route background workers to the test session factory as well.
    original_worker_session = worker_module.AsyncSessionLocal
    worker_module.AsyncSessionLocal = Session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac, Session

    worker_module.AsyncSessionLocal = original_worker_session
    app.dependency_overrides.clear()
    await engine.dispose()


async def register_and_verify(
    client: AsyncClient,
    Session,
    email: str = TEST_EMAIL,
    password: str = TEST_PASSWORD,
    name: str = "Test User",
) -> dict:
    """Register a user, verify via token, and log in."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
        },
    )
    assert resp.status_code == 201, resp.text
    dev_link = resp.json().get("dev_link")
    assert dev_link is not None, "dev_link must be present in dev/test mode"
    token = dev_link.split("token=")[1]

    # Verify email - this stores the user into the database!
    v_resp = await client.post(
        "/api/v1/auth/verify-email",
        json={"token": token},
    )
    assert v_resp.status_code == 200, v_resp.text
    return v_resp.json()

