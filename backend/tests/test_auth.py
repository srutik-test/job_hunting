"""Authentication flow tests: register/login/captcha/reset/verification/isolation."""

import pytest

from .conftest import register_and_verify


@pytest.mark.asyncio
async def test_register_and_login(client):
    ac, Session = client
    user = await register_and_verify(ac, Session)
    assert user["email"] == "tester@example.com"
    assert user["auth_provider"] == "email"

    me = await ac.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["id"] == user["id"]


@pytest.mark.asyncio
async def test_login_wrong_password_rejected(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    resp = await ac.post(
        "/api/v1/auth/login",
        json={
            "email": "tester@example.com",
            "password": "wrong-password",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_duplicate_registration_rejected(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    resp = await ac.post(
        "/api/v1/auth/register",
        json={
            "name": "Dup",
            "email": "tester@example.com",
            "password": "AnotherPass1!",
        },
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_captcha_challenge_dev_math():
    # Locally exercise the dev-math verifier with explicit provider switch.
    from app.core.config import settings
    from app.services import captcha as cap

    original = settings.CAPTCHA_PROVIDER
    settings.CAPTCHA_PROVIDER = "dev-math"
    try:
        question = None
        for _ in range(10):  # get an addition challenge for simplicity
            challenge = cap.issue_dev_challenge()
            if "+" in challenge["question"]:
                question = challenge["question"]
                break
        assert question is not None
        body = question.replace("What is ", "").replace("?", "")
        a, b = body.split("+")
        answer = int(a) + int(b)
        ok, _ = await cap.verify_captcha(
            captcha_id=challenge["captcha_id"], captcha_answer=str(answer)
        )
        assert ok
        # single-use: cannot reuse
        ok, reason = await cap.verify_captcha(
            captcha_id=challenge["captcha_id"], captcha_answer=str(answer)
        )
        assert not ok
        # wrong answer rejected
        challenge2 = cap.issue_dev_challenge()
        ok, _ = await cap.verify_captcha(
            captcha_id=challenge2["captcha_id"], captcha_answer="-999"
        )
        assert not ok
    finally:
        settings.CAPTCHA_PROVIDER = original


@pytest.mark.asyncio
async def test_password_reset_flow(client):
    ac, Session = client
    await register_and_verify(ac, Session)

    resp = await ac.post(
        "/api/v1/auth/forgot-password", json={"email": "tester@example.com"}
    )
    assert resp.status_code == 200
    dev_link = resp.json().get("dev_link")
    assert dev_link, "dev reset link should be returned when SMTP is unconfigured"
    token = dev_link.split("token=")[1]

    resp = await ac.post(
        "/api/v1/auth/reset-password",
        json={
            "token": token,
            "new_password": "N3wPassword!",
        },
    )
    assert resp.status_code == 200

    # token is single use
    resp2 = await ac.post(
        "/api/v1/auth/reset-password",
        json={
            "token": token,
            "new_password": "Other123!",
        },
    )
    assert resp2.status_code == 400

    # login works with new password
    resp3 = await ac.post(
        "/api/v1/auth/login",
        json={
            "email": "tester@example.com",
            "password": "N3wPassword!",
        },
    )
    assert resp3.status_code == 200


@pytest.mark.asyncio
async def test_protected_routes_require_auth(client):
    ac, _ = client
    assert (await ac.get("/api/v1/searches")).status_code == 401
    assert (await ac.get("/api/v1/dashboard")).status_code == 401
    assert (await ac.get("/api/v1/contacts")).status_code == 401
    assert (await ac.get("/api/v1/providers")).status_code == 401

    resp = await ac.post(
        "/api/v1/searches",
        json={
            "companies": [{"name": "Acme", "website": "https://acme.example"}],
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verification_required_for_searches(client):
    ac, Session = client
    # register but do NOT verify yet
    resp = await ac.post(
        "/api/v1/auth/register",
        json={
            "name": "Unverified",
            "email": "unverified@example.com",
            "password": "Sup3rSecret!",
        },
    )
    assert resp.status_code == 201
    dev_link = resp.json().get("dev_link")
    assert dev_link is not None
    token = dev_link.split("token=")[1]

    # User must NOT exist in the database yet
    from app.models import User
    from sqlalchemy import select

    async with Session() as db:
        res = await db.execute(
            select(User).where(User.email == "unverified@example.com")
        )
        assert res.scalars().first() is None, "User should NOT be stored in DB before email verification"

    # Attempting to log in before verification must fail
    resp_login = await ac.post(
        "/api/v1/auth/login",
        json={
            "email": "unverified@example.com",
            "password": "Sup3rSecret!",
        },
    )
    assert resp_login.status_code in (401, 403)

    # Now verify email using token
    resp_verify = await ac.post(
        "/api/v1/auth/verify-email",
        json={"token": token},
    )
    assert resp_verify.status_code == 200

    # User MUST now exist in the database and be verified
    async with Session() as db:
        res = await db.execute(
            select(User).where(User.email == "unverified@example.com")
        )
        user_in_db = res.scalars().first()
        assert user_in_db is not None
        assert user_in_db.is_email_verified is True
        assert user_in_db.account_status == "active"

    # Now login succeeds
    resp_login_after = await ac.post(
        "/api/v1/auth/login",
        json={
            "email": "unverified@example.com",
            "password": "Sup3rSecret!",
        },
    )
    assert resp_login_after.status_code == 200




@pytest.mark.asyncio
async def test_update_profile(client):
    ac, Session = client
    await register_and_verify(ac, Session)

    # Update name and avatar
    resp = await ac.put(
        "/api/v1/auth/me",
        json={
            "name": "Alex Smith",
            "profile_picture": "https://example.com/alex.jpg",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Alex Smith"
    assert data["profile_picture"] == "https://example.com/alex.jpg"

    # Fetch me to confirm persistence
    me = await ac.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Alex Smith"
    assert me.json()["profile_picture"] == "https://example.com/alex.jpg"
