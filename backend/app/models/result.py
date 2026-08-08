"""
Extraction Result model representing verified public HR contacts for a company.
"""

from datetime import datetime, timezone
import uuid
import json
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey
from app.core.database import Base


class ExtractionResult(Base):
    __tablename__ = "extraction_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(
        String(36), ForeignKey("extraction_jobs.id"), nullable=True, index=True
    )
    company_id = Column(
        String(36), ForeignKey("companies.id"), nullable=True, index=True
    )

    # Company Input Details
    company_name = Column(String(255), nullable=False, index=True)
    location = Column(String(255), nullable=True, default="")
    website = Column(String(1024), nullable=False)
    linkedin_url = Column(String(1024), nullable=True, default="")

    # Discovered Contact Details
    hr_email = Column(String(255), nullable=True, default="Not Publicly Available")
    recruitment_email = Column(
        String(255), nullable=True, default="Not Publicly Available"
    )
    careers_email = Column(String(255), nullable=True, default="Not Publicly Available")
    general_email = Column(String(255), nullable=True, default="Not Publicly Available")

    # HR Profile Details
    hr_name = Column(String(255), nullable=True, default="Not Publicly Available")
    hr_position = Column(String(255), nullable=True, default="Not Publicly Available")
    linkedin_profile_url = Column(
        String(1024), nullable=True, default="Not Publicly Available"
    )

    # Verification & Metrics
    confidence_score = Column(Integer, default=0)  # 0 to 100
    source = Column(String(1024), nullable=False, default="Not Publicly Available")
    status = Column(String(100), nullable=False, default="Not Publicly Available")

    # Audit & Diagnostics
    crawled_pages_count = Column(Integer, default=0)
    raw_details_json = Column(Text, nullable=True, default="{}")
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        try:
            raw_details = (
                json.loads(self.raw_details_json) if self.raw_details_json else {}
            )
        except Exception:
            raw_details = {}

        return {
            "id": self.id,
            "job_id": self.job_id,
            "company_id": self.company_id,
            "company_name": self.company_name,
            "location": self.location or "",
            "website": self.website,
            "linkedin_url": self.linkedin_url or "",
            "hr_email": self.hr_email or "Not Publicly Available",
            "recruitment_email": self.recruitment_email or "Not Publicly Available",
            "careers_email": self.careers_email or "Not Publicly Available",
            "general_email": self.general_email or "Not Publicly Available",
            "hr_name": self.hr_name or "Not Publicly Available",
            "hr_position": self.hr_position or "Not Publicly Available",
            "linkedin_profile": self.linkedin_profile_url or "Not Publicly Available",
            "linkedin_profile_url": self.linkedin_profile_url
            or "Not Publicly Available",
            "confidence_score": self.confidence_score,
            "source": self.source,
            "status": self.status,
            "crawled_pages_count": self.crawled_pages_count,
            "raw_details": raw_details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
