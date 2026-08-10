"""User-configured external provider with encrypted API key storage."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class APIProvider(Base):
    """
    A provider credential + activation record owned by a user.

    capability: crawler | search | email_finder | email_verifier | people
    provider_key: firecrawl | google_search | hunter | apollo | playwright ...
    """

    __tablename__ = "api_providers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    capability = Column(String(60), nullable=False)
    provider_key = Column(String(80), nullable=False)
    api_key_encrypted = Column(Text, nullable=True)  # never serialized raw
    api_key_masked = Column(String(30), nullable=True)  # '••••••••a1b2'
    enabled = Column(Boolean, nullable=False, default=True)
    status = Column(String(30), nullable=False, default="not_tested")
    # not_tested | connected | failed | missing_key
    status_detail = Column(String(500), nullable=True)  # e.g. 'Invalid API key'
    last_tested_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="providers")

    def to_dict(self) -> dict:
        """Public representation – NEVER includes the raw or encrypted key."""
        return {
            "id": self.id,
            "capability": self.capability,
            "provider_key": self.provider_key,
            "api_key_masked": self.api_key_masked,
            "has_api_key": bool(self.api_key_encrypted),
            "enabled": self.enabled,
            "status": self.status,
            "status_detail": self.status_detail,
            "last_tested_at": (
                self.last_tested_at.isoformat() if self.last_tested_at else None
            ),
        }
