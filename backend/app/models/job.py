"""
Extraction Job model tracking asynchronous processing runs.
"""
from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, Text
from app.core.database import Base


class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String(50), default="pending", index=True)  # pending, running, completed, failed, paused, cancelled
    total_companies = Column(Integer, default=0)
    processed_companies = Column(Integer, default=0)
    current_company_name = Column(String(255), nullable=True, default="")
    current_page = Column(String(1024), nullable=True, default="")
    pages_crawled_count = Column(Integer, default=0)
    emails_found_count = Column(Integer, default=0)
    profiles_found_count = Column(Integer, default=0)
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    estimated_remaining_seconds = Column(Float, default=0.0)
    
    # Metadata and errors
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        progress_pct = 0.0
        if self.total_companies > 0:
            progress_pct = round((self.processed_companies / self.total_companies) * 100, 1)
        
        return {
            "id": self.id,
            "status": self.status,
            "total_companies": self.total_companies,
            "processed_companies": self.processed_companies,
            "progress_percentage": progress_pct,
            "current_company_name": self.current_company_name or "",
            "current_page": self.current_page or "",
            "pages_crawled_count": self.pages_crawled_count,
            "emails_found_count": self.emails_found_count,
            "profiles_found_count": self.profiles_found_count,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "estimated_remaining_seconds": self.estimated_remaining_seconds or 0.0,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
