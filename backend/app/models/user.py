"""User account model."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.orm import relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(320), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=True)  # None for OAuth-only users
    profile_picture = Column(String(1024), nullable=True)
    # 'email' | 'google'
    auth_provider = Column(String(50), nullable=False, default="email")
    google_sub = Column(String(255), nullable=True, unique=True)

    is_email_verified = Column(Boolean, nullable=False, default=False)
    # 'pending' | 'active' | 'disabled'
    account_status = Column(String(50), nullable=False, default="pending", index=True)

    created_at = Column(DateTime, default=_now, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    companies = relationship(
        "Company", back_populates="user", cascade="all, delete-orphan"
    )
    searches = relationship(
        "Search", back_populates="user", cascade="all, delete-orphan"
    )
    providers = relationship(
        "APIProvider", back_populates="user", cascade="all, delete-orphan"
    )

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "profile_picture": self.profile_picture,
            "auth_provider": self.auth_provider,
            "is_email_verified": self.is_email_verified,
            "account_status": self.account_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": (
                self.last_login_at.isoformat() if self.last_login_at else None
            ),
        }
