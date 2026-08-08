"""Single-use auth token records (password reset, etc.)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime

from app.core.database import Base


class AuthToken(Base):
    """
    Stores fingerprints of issued single-use tokens so that a used
    password-reset link cannot be replayed.
    """

    __tablename__ = "auth_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    purpose = Column(String(50), nullable=False)  # 'reset-password' | 'verify-email'
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
