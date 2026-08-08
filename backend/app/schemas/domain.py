"""Domain schemas: companies, searches, contacts, providers, dashboard."""

from typing import List, Optional
from pydantic import BaseModel, Field


class CompanyInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    website: str = Field(min_length=4, max_length=1024)
    location: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    industry: Optional[str] = ""


class CompanyResponse(BaseModel):
    id: str
    name: str
    website: str
    location: str
    linkedin_url: str
    industry: str
    created_at: Optional[str] = None


class StartSearchRequest(BaseModel):
    companies: List[CompanyInput] = Field(min_length=1, max_length=100)


class SearchResponse(BaseModel):
    id: str
    company_id: str
    company: Optional[CompanyResponse] = None
    status: str
    current_step: str
    progress_pct: int
    pages_crawled: int
    emails_found: int
    profiles_found: int
    duration_seconds: float
    error_message: Optional[str] = None
    summary: Optional[str] = None
    discovery_method: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class SearchLogResponse(BaseModel):
    id: str
    level: str
    message: str
    created_at: Optional[str] = None


class ContactResponse(BaseModel):
    id: str
    search_id: str
    company_id: str
    name: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    source_type: str
    source_url: Optional[str] = None
    provider_name: Optional[str] = None
    verification_status: str
    confidence_score: int
    contact_category: str
    discovery_method: str
    created_at: Optional[str] = None


class BatchRunResponse(BaseModel):
    batch_id: str
    searches: List[SearchResponse]


# ------------------------------------------------------------------ providers
class ProviderUpsertRequest(BaseModel):
    # 'default' sentinel keeps the existing row
    api_key: Optional[str] = None
    enabled: bool = True


class ProviderResponse(BaseModel):
    id: Optional[str] = None
    capability: str
    provider_key: str
    display_name: str
    is_free: bool
    configured_via_env: bool = False
    api_key_masked: Optional[str] = None
    has_api_key: bool = False
    enabled: bool = False
    status: str = "not_tested"
    status_detail: Optional[str] = None
    last_tested_at: Optional[str] = None
    signup_url: Optional[str] = None


class ProviderTestResponse(BaseModel):
    ok: bool
    provider_key: str
    message: str
    latency_ms: int = 0
    details: dict = {}


# ------------------------------------------------------------------ dashboard
class DashboardStats(BaseModel):
    total_companies: int = 0
    total_searches: int = 0
    searches_pending: int = 0
    searches_processing: int = 0
    searches_completed: int = 0
    searches_failed: int = 0
    searches_no_results: int = 0
    total_contacts: int = 0
    verified_contacts: int = 0
    possible_contacts: int = 0
    company_emails: int = 0
    linkedin_profiles: int = 0
