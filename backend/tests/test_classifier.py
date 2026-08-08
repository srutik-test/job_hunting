"""HR classification & evidence scoring tests – the anti-fabrication core."""

import pytest

from app.services.evidence import score_for_email
from app.services.extraction.classifier import classify_email, is_hr_related
from app.services.verification.email_verifier import VerificationLevel


def test_hr_mailboxes_are_hr():
    cand = classify_email("hr@acme.com", "contact", "https://acme.com/contact", "Email our HR team")
    assert cand.relation == "hr"
    assert is_hr_related(cand)

    cand = classify_email("careers@acme.com", "careers", "", "")
    assert cand.relation == "careers"
    assert is_hr_related(cand)

    cand = classify_email("talent.acquisition@acme.com", "careers", "", "Apply today")
    assert cand.relation == "recruitment"


def test_support_is_never_hr():
    cand = classify_email("support@acme.com", "contact", "", "")
    assert cand.relation == "generic"
    assert cand.is_generic
    assert not is_hr_related(cand)


def test_generic_blocks_even_on_careers_page():
    cand = classify_email("info@acme.com", "careers", "", "jobs page")
    assert cand.is_generic
    assert cand.context_strength == 0


def test_personal_name_pattern_recognized():
    cand = classify_email("jane.doe@acme.com", "team", "", "Talent Acquisition Manager")
    assert cand.relation == "personal"
    # personal + hr context terms = hr related
    assert is_hr_related(cand)


def test_evidence_scoring_official_site_verified():
    cand = classify_email("hr@acme.com", "contact", "https://acme.com/contact",
                          "Email our HR team")
    status, category, conf, label = score_for_email(
        cand, VerificationLevel.MX_OK, "company_website")
    assert status == "verified"
    assert category == "verified_hr"
    assert conf >= 90


def test_evidence_scoring_syntax_only_is_not_verified():
    cand = classify_email("hr@acme.com", "contact", "", "HR department contacts")
    status, category, conf, label = score_for_email(
        cand, VerificationLevel.SYNTAX_ONLY, "company_website")
    assert status == "unverified"
    assert conf < 90  # must not reach verified tier


def test_support_email_scores_as_company_email():
    cand = classify_email("support@acme.com", "contact", "", "")
    status, category, conf, label = score_for_email(
        cand, VerificationLevel.MX_OK, "company_website")
    assert category == "company_email"
    assert label == "company"
    assert conf <= 80


def test_invalid_email_gets_zero_confidence():
    cand = classify_email("hr@acme.com", "careers", "", "")
    status, category, conf, label = score_for_email(
        cand, VerificationLevel.INVALID, "company_website")
    assert conf == 0


@pytest.mark.asyncio
async def test_syntax_validation():
    from app.services.verification.email_verifier import syntax_valid
    assert syntax_valid("jane.doe@company.com")
    assert syntax_valid("hr-team@company.co.uk")
    assert not syntax_valid("not-an-email")
    assert not syntax_valid("@company.com")
    assert not syntax_valid("jane@")
    assert not syntax_valid("")
