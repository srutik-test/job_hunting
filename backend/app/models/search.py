"""Search job model – one discovery run against one company."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Search(Base):
    """
    A company/email discovery search requested by a user.
    Status lifecycle: pending -> processing -> completed | failed | no_results.
    """

    __tablename__ = "searches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    status = Column(String(50), nullable=False, default="pending", index=True)
    # pending | processing | completed | no_results | failed
    current_step = Column(String(255), nullable=True, default="")
    progress_pct = Column(Integer, nullable=False, default=0)

    pages_crawled = Column(Integer, default=0)
    emails_found = Column(Integer, default=0)
    profiles_found = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)

    error_message = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)          # final 'no verified…' style message
    discovery_method = Column(String(80), nullable=True)  # website | provider | linkedin | mixed

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        index=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="searches")
    company = relationship("Company", back_populates="searches")
    contacts = relationship("HRContact", back_populates="search",
                            cascade="all, delete-orphan")
    logs = relationship("SearchLog", back_populates="search",
                        cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "company": self.company.to_dict() if self.company else None,
            "status": self.status,
            "current_step": self.current_step or "",
            "progress_pct": self.progress_pct,
            "pages_crawled": self.pages_crawled or 0,
            "emails_found": self.emails_found or 0,
            "profiles_found": self.profiles_found or 0,
            "duration_seconds": self.duration_seconds or 0.0,
            "error_message": self.error_message,
            "summary": self.summary,
            "discovery_method": self.discovery_method,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
        }


class SearchLog(Base):
    """Structured progress/debug log lines for a search."""

    __tablename__ = "search_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    search_id = Column(String(36), ForeignKey("searches.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    level = Column(String(20), nullable=False, default="info")  # info | success | warning | error
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        index=True)

    search = relationship("Search", back_populates="logs")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "level": self.level,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
