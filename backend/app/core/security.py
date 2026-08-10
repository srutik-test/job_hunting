"""
Security helpers: password hashing, JWT access tokens, and
single-purpose tokens for email verification / password reset.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

password_hash = PasswordHash.recommended()  # Argon2id


# --------------------------------------------------------------------- passwords
def hash_password(plain: str) -> str:
    return password_hash.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return password_hash.verify(plain, hashed)
    except Exception:
        return False


# --------------------------------------------------------------------- jwt tokens
def _create_token(
    subject: str,
    purpose: str,
    expires_minutes: int,
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": subject,
        "purpose": purpose,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
        "jti": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _create_token(user_id, "access", settings.ACCESS_TOKEN_EXPIRE_MINUTES)


def create_email_verification_token(user_id: str) -> str:
    return _create_token(
        user_id, "verify-email", settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )


def create_password_reset_token(user_id: str) -> str:
    return _create_token(
        user_id, "reset-password", settings.PASSWORD_RESET_EXPIRE_MINUTES
    )


def decode_token(token: str, expected_purpose: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT. Returns payload or None on any failure."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != expected_purpose:
        return None
    return payload


def token_fingerprint(token: str) -> str:
    """Stable hash used to mark single-use tokens (password reset)."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_captcha_id() -> str:
    return secrets.token_urlsafe(24)
