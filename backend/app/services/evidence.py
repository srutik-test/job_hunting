"""
Evidence-based confidence & verification taxonomy.

Confidence describes *how much real-world evidence* exists for a result —
never model guesswork:

  95–100   Verified: address found on the official company website AND the
           domain has valid MX records (verified to the strongest check run).
  90+      Found by a reliable professional-data provider AND verified by
           that provider or by MX validation.
  70–89    Strong evidence but incomplete verification
           (e.g. found on official site, MX check failed/inconclusive).
  50–69    Potential match — shown as "Possible" and never as verified.
  0        No evidence — no email is produced at all.

Rules enforced system-wide:
* No email is ever generated, guessed, or pattern-inferred.
* verification_status = 'verified' requires an MX check passing or a
  provider-side verification – syntax checking alone is never enough.
* HR classification requires HR evidence (local-part keywords, page type,
  or surrounding context). Generic company mailboxes are not HR.
"""

from typing import Optional, Tuple

from app.services.verification.email_verifier import VerificationLevel
from app.services.extraction.classifier import EmailCandidate, is_hr_related

VERIFIED = "verified"
PARTIALLY_VERIFIED = "partially_verified"
UNVERIFIED = "unverified"


def score_for_email(
    candidate: EmailCandidate,
    verification: VerificationLevel,
    source_type: str,  # company_website | search_provider | email_finder | people_provider
    provider_says_verified: bool = False,
) -> Tuple[str, str, int, str]:
    """
    Compute (verification_status, contact_category, confidence, hr_label).

    Returns ('' / 'no_email') level entries with confidence 0 when the
    evidence does not justify surfacing the address as an HR contact —
    callers then place it in the company_email bucket instead.
    """
    hr_related = is_hr_related(candidate)

    if verification in (VerificationLevel.INVALID, VerificationLevel.ERROR):
        return UNVERIFIED, "company_email", 0, "not_hr"

    verified_by_check = (
        verification in (VerificationLevel.MX_OK, VerificationLevel.SMTP_OK)
        or provider_says_verified
    )

    if source_type == "company_website":
        if verified_by_check:
            base = 95 if hr_related else 90
            status = (
                VERIFIED
                if verification in (VerificationLevel.MX_OK, VerificationLevel.SMTP_OK)
                else PARTIALLY_VERIFIED
            )
        elif verification == VerificationLevel.DOMAIN_OK:
            base, status = 85, PARTIALLY_VERIFIED
        else:  # syntax-only
            base, status = 70, UNVERIFIED
    elif source_type in ("email_finder", "people_provider"):
        if provider_says_verified:
            base, status = 90, VERIFIED
        elif verified_by_check:
            base, status = 85, VERIFIED
        elif verification == VerificationLevel.DOMAIN_OK:
            base, status = 75, UNVERIFIED
        else:
            base, status = 60, UNVERIFIED
    else:  # search provider / other
        if verified_by_check:
            base, status = 80, PARTIALLY_VERIFIED
        else:
            base, status = 55, UNVERIFIED

    if hr_related:
        category = (
            "verified_hr"
            if (status == VERIFIED and base >= 90 and source_type == "company_website")
            else ("verified_hr" if provider_says_verified else "possible_hr")
        )
        return status, category, base, "hr"

    # Not HR-related: keep as company email (real, but not an HR contact).
    category = "company_email"
    if verified_by_check:
        return status, category, min(base, 80), "company"
    return status, category, max(base - 20, 0), "company"
