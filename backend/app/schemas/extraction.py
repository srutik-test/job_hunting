"""
Extraction request and event schemas.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.company import CompanyBase


class ManualExtractionRequest(BaseModel):
    companies: List[CompanyBase]
    crawler_engine: str = "auto"
    enable_public_search: bool = True
    max_pages_per_company: int = 20


class SingleCompanyExtractionRequest(CompanyBase):
    crawler_engine: str = "auto"
    enable_public_search: bool = True
    max_pages_per_company: int = 20


class ExtractionLogEvent(BaseModel):
    job_id: str
    level: str
    message: str
    timestamp: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
