"""HR contact model – a discovered, evidence-backed contact."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class HRContact(Base):
    """
    A real contact discovered from a verifiable source.

    contact_category:
      verified_hr   – HR/recruitment email with strong evidence
      possible_hr   – likely HR person/email but incomplete verification
      company_email – a real company email that is NOT confirmed HR
      linkedin      – an identified HR person (LinkedIn data, possibly no email)

    verification_status: verified | partially_verified | unverified
    """

    __tablename__ = "hr_contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    search_id = Column(String(36), ForeignKey("searches.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    name = Column(String(255), nullable=True)           # None when unknown
    designation = Column(String(255), nullable=True)    # job title
    email = Column(String(320), nullable=True)          # None when no email evidence
    linkedin_url = Column(String(1024), nullable=True)

    # provenance
    source_type = Column(String(80), nullable=False)
    # company_website | search_provider | email_finder | people_provider | linkedin_page
    source_url = Column(String(1024), nullable=True)
    provider_name = Column(String(120), nullable=True)

    verification_status = Column(String(50), nullable=False, default="unverified")
    confidence_score = Column(Integer, nullable=False, default=0)  # 0-100, evidence based
    contact_category = Column(String(50), nullable=False, default="company_email",
                            index=True)
    discovery_method = Column(String(80), nullable=False, default="unknown")
    # website_crawl | browser_crawl | firecrawl | hunter | apollo | google_search | duckduckgo | linkedin_public_index

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        index=True)

    search = relationship("Search", back_populates="contacts")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "search_id": self.search_id,
            "company_id": self.company_id,
            "name": self.name,
            "designation": self.designation,
            "email": self.email,
            "linkedin_url": self.linkedin_url,
            "source_type": self.source_type,
            "source_url": self.source_url,
            "provider_name": self.provider_name,
            "verification_status": self.verification_status,
            "confidence_score": self.confidence_score,
            "contact_category": self.contact_category,
            "discovery_method": self.discovery_method,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
