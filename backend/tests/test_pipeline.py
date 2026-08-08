"""
Unit tests for the ExtractionCoordinator pipeline.
"""
import pytest
from app.services.pipeline.coordinator import ExtractionCoordinator


@pytest.mark.asyncio
async def test_coordinator_execution_and_structure():
    coordinator = ExtractionCoordinator(
        crawler_engine="auto",
        enable_public_search=False
    )
    
    # Process a company with a controlled crawl
    result = await coordinator.process_company(
        company_name="Aspire Softserv",
        website="https://aspiresoftserv.com",
        location="Ahmedabad",
        linkedin_url="https://linkedin.com/company/aspire-softserv",
        max_pages=2
    )

    assert result is not None
    assert result["company_name"] == "Aspire Softserv"
    assert result["website"] == "https://aspiresoftserv.com"
    assert "status" in result
    assert "confidence_score" in result
    assert "hr_email" in result
    assert "recruitment_email" in result
    assert "careers_email" in result
    assert "general_email" in result
    assert "hr_name" in result
    assert "hr_position" in result
    assert "linkedin_profile" in result
    assert "source" in result
    assert isinstance(result["confidence_score"], int)
    assert 0 <= result["confidence_score"] <= 100
