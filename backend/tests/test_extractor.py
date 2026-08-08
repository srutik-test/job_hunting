"""
Unit tests for Email Classification and Verification logic.
"""
import pytest
from app.services.extractor.email_classifier import classify_email, select_best_contacts
from app.services.extractor.verifier import ContactVerifier
from app.services.extractor.linkedin_finder import LinkedInFinder


def test_email_classification():
    # HR email
    hr_res = classify_email("hr@aspiresoftserv.com", page_type="careers")
    assert hr_res.category == "HR"
    assert hr_res.confidence_weight >= 90
    assert hr_res.is_generic is False

    # Recruitment email
    rec_res = classify_email("recruitment@simform.com", page_type="jobs")
    assert rec_res.category == "Recruitment"
    assert rec_res.confidence_weight >= 90

    # Careers mailbox
    car_res = classify_email("careers@tatvasoft.com", page_type="careers")
    assert car_res.category == "Careers"
    assert car_res.confidence_weight >= 90

    # Generic mailbox
    gen_res = classify_email("info@aspiresoftserv.com", page_type="contact")
    assert gen_res.category == "General Contact"
    assert gen_res.is_generic is True
    assert gen_res.confidence_weight == 70


def test_select_best_contacts_priority():
    emails = [
        classify_email("info@aspiresoftserv.com", page_type="contact"),
        classify_email("careers@aspiresoftserv.com", page_type="careers"),
        classify_email("hr@aspiresoftserv.com", page_type="careers"),
    ]
    (hr, recruit, careers, general, source, score) = select_best_contacts(emails)
    assert hr == "hr@aspiresoftserv.com"
    assert careers == "careers@aspiresoftserv.com"
    assert score >= 90


def test_status_and_confidence_evaluation():
    status, score = ContactVerifier.evaluate_verification_status(
        hr_email="hr@aspiresoftserv.com",
        recruitment_email="recruitment@aspiresoftserv.com",
        careers_email="careers@aspiresoftserv.com",
        general_email="info@aspiresoftserv.com",
        hr_profile_url="https://linkedin.com/in/hr-manager",
        source="Official Careers Page"
    )
    assert status == "Verified Public HR Email"
    assert score >= 90

    # When no HR email, only general
    status_gen, score_gen = ContactVerifier.evaluate_verification_status(
        hr_email="Not Publicly Available",
        recruitment_email="Not Publicly Available",
        careers_email="Not Publicly Available",
        general_email="info@company.com",
        hr_profile_url="Not Publicly Available",
        source="Contact Page"
    )
    assert status_gen == "General Contact Email"
    assert score_gen == 70


def test_linkedin_search_snippet_parser():
    snippet = "Senior Technical Recruiter at Aspire Softserv. Ahmedabad, India."
    title = "Jane Doe - Senior Technical Recruiter - Aspire Softserv | LinkedIn"
    url = "https://www.linkedin.com/in/janedoe-recruiter-12345"

    profile = LinkedInFinder.parse_public_search_snippet(
        title=title,
        snippet=snippet,
        profile_url=url,
        company_name="Aspire Softserv"
    )
    assert profile is not None
    assert profile.name == "Jane Doe"
    assert "Recruiter" in profile.job_title
    assert "janedoe-recruiter-12345" in profile.linkedin_profile_url
