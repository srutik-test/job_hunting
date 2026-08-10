"""
Evidence-based confidence & verification taxonomy.

This module implements STRICT evidence-based confidence scoring.
The confidence score represents ACTUAL EVIDENCE AVAILABLE, not optimistic estimates.

CRITICAL RULES:
* No email is ever generated, guessed, or pattern-inferred.
* verification_status = 'verified' requires an MX check passing or a
  provider-side verification – syntax checking alone is never enough.
* HR classification requires HR evidence (local-part keywords, page type,
  or surrounding context). Generic company mailboxes are NOT HR.
* A confidence score of 80-90% should NOT be given to emails that are
  actually fake or unrelated to HR.

CONFIDENCE SCORE DEFINITIONS:
─────────────────────────────
90-100%: STRONG DIRECT EVIDENCE
  - Email found on official company HR/recruitment page
  - Source is highly reliable (company website, official careers page)
  - Email clearly belongs to HR/recruitment/talent acquisition
  - Ideally confirmed by multiple reliable sources

75-89%: STRONG EVIDENCE BUT INCOMPLETE
  - Strong evidence that email belongs to HR/recruitment
  - Some supporting evidence exists, but not enough for highest confidence
  - Verification may be partial

50-74%: POSSIBLE HR CONNECTION
  - Possible HR/recruitment connection, but evidence incomplete
  - NOT shown in verified results by default

25-49%: WEAK INDICATION ONLY
  - Weak indication only
  - NOT included in verified HR-email results

0-24%: NO MEANINGFUL EVIDENCE
  - No meaningful evidence
  - Treat as unverified and EXCLUDE from results
"""

from typing import Optional, Tuple

from app.services.verification.email_verifier import VerificationLevel
from app.services.extraction.classifier import EmailCandidate, is_hr_related, is_verified_hr_email


VERIFIED = "verified"
PARTIALLY_VERIFIED = "partially_verified"
UNVERIFIED = "unverified"

# Source quality tiers (higher = more reliable)
SOURCE_TIER_COMPANY_WEBSITE = 100
SOURCE_TIER_SEARCH_PROVIDER = 50
SOURCE_TIER_EMAIL_FINDER = 40
SOURCE_TIER_PEOPLE_PROVIDER = 45


def score_for_email(
    candidate: EmailCandidate,
    verification: VerificationLevel,
    source_type: str,   # company_website | search_provider | email_finder | people_provider
    provider_says_verified: bool = False,
) -> Tuple[str, str, int, str]:
    """
    Compute (verification_status, contact_category, confidence, hr_label).
    
    This function implements STRICT evidence-based scoring.
    
    Returns ('' / 'no_email') level entries with confidence 0 when the
    evidence does not justify surfacing the address as an HR contact —
    callers then place it in the company_email bucket instead.
    """
    # =================================================================
    # STEP 1: Reject invalid emails immediately
    # =================================================================
    if verification in (VerificationLevel.INVALID, VerificationLevel.ERROR):
        return UNVERIFIED, "company_email", 0, "not_hr"
    
    # =================================================================
    # STEP 2: Generic emails are NEVER HR contacts
    # =================================================================
    if candidate.is_generic:
        # It's a real email, but NOT HR - downgrade confidence
        base_confidence = 15 if verification in (
            VerificationLevel.MX_OK, VerificationLevel.SMTP_OK
        ) else 5
        return UNVERIFIED, "company_email", base_confidence, "company"
    
    # =================================================================
    # STEP 3: Check if email is HR-related
    # =================================================================
    hr_related = is_hr_related(candidate)
    
    # =================================================================
    # STEP 4: Determine verification status
    # =================================================================
    verified_by_check = verification in (
        VerificationLevel.MX_OK, VerificationLevel.SMTP_OK
    ) or provider_says_verified
    
    # =================================================================
    # STEP 5: Calculate base confidence based on source type
    # =================================================================
    
    if source_type == "company_website":
        # Company website is the most reliable source
        base = _score_company_website(hr_related, candidate, verified_by_check, verification)
    elif source_type in ("email_finder", "people_provider"):
        # External providers - need verification to be reliable
        base = _score_external_provider(hr_related, verified_by_check, verification, provider_says_verified)
    else:
        # Search provider - public index, lower reliability
        base = _score_search_provider(hr_related, verified_by_check, verification)
    
    # =================================================================
    # STEP 6: Adjust confidence based on context strength
    # =================================================================
    # Context strength is 0-10, map to confidence adjustment
    context_bonus = _context_to_confidence_bonus(candidate.context_strength)
    base = min(base + context_bonus, 100)
    
    # =================================================================
    # STEP 7: Determine verification status label
    # =================================================================
    if verified_by_check and base >= 75:
        status = VERIFIED
    elif verified_by_check or base >= 60:
        status = PARTIALLY_VERIFIED
    else:
        status = UNVERIFIED
    
    # =================================================================
    # STEP 8: Determine contact category
    # =================================================================
    if hr_related:
        if status == VERIFIED and base >= 75:
            category = "verified_hr"
        elif base >= 50:
            category = "possible_hr"
        else:
            category = "company_email"  # Not enough evidence for HR
        return status, category, max(base, 0), "hr"
    
    # Not HR-related: keep as company email (real, but not an HR contact)
    category = "company_email"
    if verified_by_check:
        return status, category, min(base, 60), "company"
    return status, category, max(base - 20, 0), "company"


def _score_company_website(
    hr_related: bool,
    candidate: EmailCandidate,
    verified_by_check: bool,
    verification: VerificationLevel,
) -> int:
    """
    Calculate confidence for emails found on the company website.
    
    Rules:
    - Official company website is the most reliable source
    - But we still need real evidence, not just the fact that it's on the site
    - hr@company.com is NOT automatically 90% - it needs context evidence
    """
    if not hr_related:
        # Not HR-related - real but not HR
        if verified_by_check:
            return 55
        return 25
    
    # HR-related email on company website
    if verified_by_check:
        # MX or SMTP verified
        return 85  # Strong but not maximum without context
    elif verification == VerificationLevel.DOMAIN_OK:
        # Domain resolves, no MX - partial verification
        return 65
    else:
        # Syntax only or no verification
        # NOTE: An hr@company.com that only passes syntax is NOT 90%
        return 40  # Weak - needs actual verification


def _score_external_provider(
    hr_related: bool,
    verified_by_check: bool,
    verification: VerificationLevel,
    provider_says_verified: bool,
) -> int:
    """
    Calculate confidence for emails from external providers (Hunter, Apollo, etc.).
    
    Rules:
    - External providers are helpful but less reliable than company website
    - Provider verification is useful but should be weighted carefully
    - Still need actual HR context evidence
    """
    if not hr_related:
        return 20  # Real email, but not HR
    
    if provider_says_verified:
        # Provider claims verification
        if verified_by_check:
            return 80  # Both provider and our check agree
        return 60  # Only provider verification
    
    if verified_by_check:
        return 55  # Our verification but no provider verification
    
    return 25  # Neither verified - weak evidence


def _score_search_provider(
    hr_related: bool,
    verified_by_check: bool,
    verification: VerificationLevel,
) -> int:
    """
    Calculate confidence for emails from public search indexes.
    
    Rules:
    - Public search results are less reliable
    - Need strong verification to be confident
    - Need HR context evidence
    """
    if not hr_related:
        return 15  # Real but not HR
    
    if verified_by_check:
        if verification == VerificationLevel.SMTP_OK:
            return 70  # Strong verification from public source
        return 50  # MX check only
    
    return 20  # No verification from public source - weak


def _context_to_confidence_bonus(context_strength: int) -> int:
    """
    Convert context strength (0-10) to confidence bonus (0-15).
    
    Context provides additional evidence but shouldn't dominate
    the confidence calculation.
    """
    if context_strength <= 0:
        return 0
    elif context_strength <= 2:
        return 2
    elif context_strength <= 4:
        return 5
    elif context_strength <= 6:
        return 8
    elif context_strength <= 8:
        return 12
    else:
        return 15


def get_display_confidence(
    verification_status: str,
    confidence_score: int,
    contact_category: str,
) -> int:
    """
    Get the display confidence for UI purposes.
    
    This applies final filtering to ensure we don't show
    inflated confidence scores.
    
    Rules:
    - verified_hr: Show actual confidence if >= 75, else upgrade to "possible_hr"
    - possible_hr: Show confidence if >= 50, else downgrade
    - company_email: Never show as HR
    - linkedin: Show 0 or actual confidence for profiles without emails
    """
    if contact_category == "verified_hr":
        if confidence_score >= 75:
            return confidence_score
        elif confidence_score >= 50:
            return confidence_score  # Will show as "possible_hr"
        else:
            return 0  # Not enough evidence
    
    if contact_category == "possible_hr":
        if confidence_score >= 50:
            return confidence_score
        else:
            return 0  # Not enough evidence
    
    if contact_category == "company_email":
        # Real emails, but NOT HR - show with low confidence
        return min(confidence_score, 40)
    
    if contact_category == "linkedin":
        # Profiles without emails
        return confidence_score if confidence_score > 0 else 0
    
    return 0
