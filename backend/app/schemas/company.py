"""
Company Pydantic schemas.
"""

from typing import Optional, List
from pydantic import BaseModel, Field, HttpUrl, field_validator


class CompanyBase(BaseModel):
    name: str = Field(
        ..., min_length=1, max_length=255, description="Official company name"
    )
    location: Optional[str] = Field(
        default="", max_length=255, description="Headquarters or branch location"
    )
    website: str = Field(
        ..., min_length=3, max_length=1024, description="Official company website URL"
    )
    linkedin_url: Optional[str] = Field(
        default="", max_length=1024, description="Public LinkedIn company URL"
    )

    @field_validator("website")
    @classmethod
    def normalize_website(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Website cannot be empty")
        if not v.startswith(("http://", "https://")):
            v = "https://" + v
        return v.rstrip("/")

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Company name cannot be empty")
        return v


class CompanyCreate(CompanyBase):
    pass


class CompanyResponse(CompanyBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class CompanyBatchUploadPreview(BaseModel):
    total_parsed: int
    valid_count: int
    invalid_count: int
    preview_items: List[CompanyBase]
    detected_columns: List[str]
    missing_columns: List[str]
    warnings: List[str]
