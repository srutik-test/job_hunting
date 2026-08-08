"""
Extraction Result Pydantic schemas.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ResultResponse(BaseModel):
    id: str
    job_id: Optional[str] = None
    company_id: Optional[str] = None
    company_name: str
    location: str
    website: str
    linkedin_url: str
    hr_email: str
    recruitment_email: str
    careers_email: str
    general_email: str
    hr_name: str
    hr_position: str
    linkedin_profile: str
    confidence_score: int
    source: str
    status: str
    crawled_pages_count: int
    raw_details: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ResultListResponse(BaseModel):
    items: List[ResultResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ResultFilterParams(BaseModel):
    search: Optional[str] = None
    status: Optional[str] = None
    min_confidence: Optional[int] = None
    has_hr_email: Optional[bool] = None
    has_linkedin_profile: Optional[bool] = None
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = "desc"
    page: int = 1
    page_size: int = 25
