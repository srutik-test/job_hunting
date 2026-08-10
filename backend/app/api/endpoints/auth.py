"""Authentication endpoints – register, login, Google OAuth, verification, reset."""

from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ACCESS_COOKIE, get_current_user
from app.core.rate_limit import rate_limit
from app.core.security import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_token,
    hash_password,
    token_fingerprint,
    verify_password,
)
from app.models import AuthToken, User
from app.schemas.auth import (
    CaptchaChallenge,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserPublic,
    VerifyEmailRequest,
)
from app.services import captcha as captcha_service
from app.services import mailer

router = APIRouter(prefix="/auth", tags=["Authentication"])

_auth_limit = rate_limit(settings.RATE_LIMIT_AUTH, scope="auth")


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )


def _public(user: User) -> dict:
    return user.to_public()


async def _ensure_captcha(payload: object, request: Request) -> None:
    ok, reason = await captcha_service.verify_captcha(
        captcha_token=getattr(payload, "captcha_token", None),
        captcha_id=getattr(payload, "captcha_id", None),
        captcha_answer=getattr(payload, "captcha_answer", None),
        remote_ip=request.client.host if request.client else None,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reason or "CAPTCHA verification failed.",
        )


# ------------------------------------------------------------------ captcha
@router.get("/captcha/config", response_model=dict)
async def captcha_config():
    return captcha_service.captcha_config()


@router.get("/captcha/challenge", response_model=CaptchaChallenge)
async def captcha_challenge():
    cfg = captcha_service.captcha_config()
    if cfg["provider"] == "none":
        return CaptchaChallenge(enabled=False, provider="none")
    if cfg["provider"] == "dev-math":
        challenge = captcha_service.issue_dev_challenge()
        return CaptchaChallenge(provider="dev-math", **challenge)
    return CaptchaChallenge(provider=cfg["provider"], site_key=cfg["site_key"])


# ------------------------------------------------------------------ registration
@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=201,
    dependencies=[Depends(_auth_limit)],
)
async def register(
    payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    await _ensure_captcha(payload, request)

    email = payload.email.lower()
    res = await db.execute(select(User).where(User.email == email))
    if res.scalars().first() is not None:
        raise HTTPException(
            status_code=409, detail="An account with this email already exists."
        )

    user = User(
        email=email,
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        auth_provider="email",
        is_email_verified=False,
        account_status="pending",
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_email_verification_token(user.id)
    db.add(
        AuthToken(
            user_id=user.id,
            purpose="verify-email",
            token_hash=token_fingerprint(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES),
        )
    )
    await db.commit()

    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    sent = await mailer.send_verification_email(user.email, user.name, link)
    dev_link = None if sent else link
    return MessageResponse(
        message=(
            "Registration successful. Please check your inbox to verify "
            "your email address."
            if sent
            else "Registration successful (development mode: SMTP not configured "
            "– use the returned verification link)."
        ),
        dev_link=dev_link if settings.DEBUG else None,
    )


# ------------------------------------------------------------------ login/logout
@router.post("/login", response_model=UserPublic, dependencies=[Depends(_auth_limit)])
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_captcha(payload, request)

    email = payload.email.lower()
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalars().first()
    if (
        user is None
        or not user.hashed_password
        or not verify_password(payload.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if user.account_status == "disabled":
        raise HTTPException(status_code=403, detail="Account is disabled.")

    user.last_login_at = datetime.now(timezone.utc)
    if user.is_email_verified and user.account_status == "pending":
        user.account_status = "active"
    await db.commit()

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)
    return _public(user)


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response):
    response.delete_cookie(ACCESS_COOKIE, path="/")
    return MessageResponse(message="Logged out.")


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)):
    return _public(user)


# ------------------------------------------------------------------ verification
@router.post("/verify-email", response_model=UserPublic)
async def verify_email(
    payload: VerifyEmailRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    data = decode_token(payload.token, "verify-email")
    if not data:
        raise HTTPException(
            status_code=400, detail="Invalid or expired verification link."
        )

    res = await db.execute(
        select(AuthToken).where(
            AuthToken.token_hash == token_fingerprint(payload.token),
            AuthToken.purpose == "verify-email",
        )
    )
    record = res.scalars().first()
    if record and record.used:
        # already verified previously; idempotent success is fine
        pass

    res = await db.execute(select(User).where(User.id == data["sub"]))
    user = res.scalars().first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found.")

    user.is_email_verified = True
    user.account_status = "active"
    if record:
        record.used = True
    await db.commit()

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)
    return _public(user)


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    dependencies=[Depends(_auth_limit)],
)
async def resend_verification(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if user.is_email_verified:
        return MessageResponse(message="Email address is already verified.")
    token = create_email_verification_token(user.id)
    db.add(
        AuthToken(
            user_id=user.id,
            purpose="verify-email",
            token_hash=token_fingerprint(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES),
        )
    )
    await db.commit()
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    sent = await mailer.send_verification_email(user.email, user.name, link)
    return MessageResponse(
        message=(
            "Verification email sent."
            if sent
            else "Verification link generated (development mode)."
        ),
        dev_link=None if sent else (link if settings.DEBUG else None),
    )


# ------------------------------------------------------------------ password reset
@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(_auth_limit)],
)
async def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    await _ensure_captcha(payload, request)

    email = payload.email.lower()
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalars().first()

    generic = (
        "If an account exists for this email address, a password reset "
        "link has been sent."
    )
    if user is None or not user.hashed_password:
        return MessageResponse(message=generic)

    token = create_password_reset_token(user.id)
    db.add(
        AuthToken(
            user_id=user.id,
            purpose="reset-password",
            token_hash=token_fingerprint(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        )
    )
    await db.commit()

    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    sent = await mailer.send_password_reset_email(user.email, user.name, link)
    return MessageResponse(
        message=generic,
        dev_link=None if sent else (link if settings.DEBUG else None),
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    data = decode_token(payload.token, "reset-password")
    if not data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    res = await db.execute(
        select(AuthToken).where(
            AuthToken.token_hash == token_fingerprint(payload.token),
            AuthToken.purpose == "reset-password",
        )
    )
    record = res.scalars().first()
    if record is None or record.used:
        raise HTTPException(status_code=400, detail="Reset link has already been used.")
    expires_naive = record.expires_at.replace(tzinfo=None)
    if expires_naive < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Reset link has expired.")

    res = await db.execute(select(User).where(User.id == data["sub"]))
    user = res.scalars().first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found.")

    user.hashed_password = hash_password(payload.new_password)
    record.used = True
    await db.commit()
    return MessageResponse(message="Password updated. You can now log in.")


# ------------------------------------------------------------------ google oauth
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def _google_redirect_uri() -> str:
    return f"{settings.BACKEND_PUBLIC_URL}{settings.API_V1_STR}/auth/google/callback"


@router.get("/google/login")
async def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=501, detail="Google sign-in is not configured on the server."
        )
    state = jwt.encode(
        {
            "purpose": "oauth-state",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": _google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    from urllib.parse import urlencode

    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(
    response: Response,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    frontend = settings.FRONTEND_URL.rstrip("/")
    if not code or not state:
        return RedirectResponse(f"{frontend}/login?error=oauth_failed")
    try:
        jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return RedirectResponse(f"{frontend}/login?error=oauth_state")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": _google_redirect_uri(),
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code != 200:
                raise ValueError("token exchange failed")
            id_token = token_resp.json().get("id_token")
            info_resp = await client.get(
                GOOGLE_TOKENINFO_URL, params={"id_token": id_token}
            )
            if info_resp.status_code != 200:
                raise ValueError("tokeninfo failed")
            info = info_resp.json()
    except Exception:
        return RedirectResponse(f"{frontend}/login?error=oauth_exchange")

    google_sub = info.get("sub")
    email = (info.get("email") or "").lower()
    if info.get("aud") != settings.GOOGLE_CLIENT_ID or not google_sub or not email:
        return RedirectResponse(f"{frontend}/login?error=oauth_claims")
    email_verified = info.get("email_verified") in (True, "true", "True")

    res = await db.execute(select(User).where(User.email == email))
    user = res.scalars().first()
    if user is None:
        user = User(
            email=email,
            name=info.get("name") or email.split("@")[0],
            auth_provider="google",
            google_sub=google_sub,
            profile_picture=info.get("picture"),
            is_email_verified=email_verified,
            account_status="active" if email_verified else "pending",
            last_login_at=datetime.now(timezone.utc),
        )
        db.add(user)
    else:
        user.google_sub = user.google_sub or google_sub
        user.profile_picture = user.profile_picture or info.get("picture")
        if email_verified:
            user.is_email_verified = True
            if user.account_status == "pending":
                user.account_status = "active"
        user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    redirect = RedirectResponse(f"{frontend}/login?oauth=success")
    _set_auth_cookie(redirect, token)
    return redirect
