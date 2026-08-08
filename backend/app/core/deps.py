"""Authentication dependencies shared by API endpoints."""

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models import User

ACCESS_COOKIE = "access_token"


def extract_token(request: Request) -> Optional[str]:
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Not authenticated.")
    payload = decode_token(token, "access")
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired session.")

    res = await db.execute(select(User).where(User.id == payload["sub"]))
    user = res.scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Account no longer exists.")
    if user.account_status == "disabled":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="This account has been disabled.")
    return user


async def get_verified_user(user: User = Depends(get_current_user)) -> User:
    """Require a verified email address (used by search endpoints)."""
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before running searches. "
                   "Use /auth/resend-verification to get a new link.",
        )
    return user
