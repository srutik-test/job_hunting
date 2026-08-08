"""
Extraction Job Pydantic schemas.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    company_ids: Optional[List[str]] = None
    crawler_engine: Optional[str] = Field(default="auto", description="Crawler preference: auto, aiohttp, firecrawl, playwright")
    enable_public_search: bool = Field(default=True, description="Search public business directories and indexes")
    max_pages_per_company: int = Field(default=20, ge=1, le=100)
    concurrency: int = Field(default=3, ge=1, le=10)


class JobProgressResponse(BaseModel):
    id: str
    status: str
    total_companies: int
    processed_companies: int
    progress_percentage: float
    current_company_name: str
    current_page: str
    pages_crawled_count: int
    emails_found_count: int
    profiles_found_count: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    estimated_remaining_seconds: float = 0.0
    error_message: Optional[str] = None


class JobStatsResponse(BaseModel):
    total_jobs: int
    total_companies_processed: int
    total_verified_hr_emails: int
    total_recruitment_emails: int
    total_general_emails: int
    total_linkedin_profiles: int
    overall_hr_discovery_rate: float
    average_confidence_score: float
    active_job_id: Optional[str] = None
