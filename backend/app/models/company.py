"""Company model – a target company owned by a user."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False, index=True)
    website = Column(String(1024), nullable=False)
    location = Column(String(255), nullable=True, default="")
    linkedin_url = Column(String(1024), nullable=True, default="")
    industry = Column(String(255), nullable=True, default="")
    meta = Column(Text, nullable=True, default="{}")  # JSON blob for extra metadata

    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )

    user = relationship("User", back_populates="companies")
    searches = relationship(
        "Search", back_populates="company", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "website": self.website,
            "location": self.location or "",
            "linkedin_url": self.linkedin_url or "",
            "industry": self.industry or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
