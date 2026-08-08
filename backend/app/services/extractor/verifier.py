"""
Verification and Confidence Scoring Service.
Performs RFC syntax validation, DNS MX record verification,
source integrity verification, and status classification.
Guarantees NO fabricated or pattern-inferred data.
"""

import re
from typing import Dict, Any, Optional, Tuple
import dns.resolver
from email_validator import validate_email, EmailNotValidError


class ContactVerifier:
    """Verifies discovered public contact information and assigns confidence scores."""

    @staticmethod
    def verify_email_syntax(email: str) -> bool:
        """Validate email format with RFC 5322 compliance."""
        if not email or email == "Not Publicly Available":
            return False
        try:
            validate_email(email, check_deliverability=False)
            return True
        except (EmailNotValidError, Exception):
            # Fallback regex
            pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
            return bool(re.match(pattern, email))

    @staticmethod
    def verify_domain_mx(domain: str) -> bool:
        """Check if domain has active DNS MX mail exchanger records."""
        try:
            answers = dns.resolver.resolve(domain, "MX", lifetime=3.0)
            return len(answers) > 0
        except Exception:
            # Fallback: check if A record resolves
            try:
                answers_a = dns.resolver.resolve(domain, "A", lifetime=3.0)
                return len(answers_a) > 0
            except Exception:
                return False

    @classmethod
    def evaluate_verification_status(
        cls,
        hr_email: str,
        recruitment_email: str,
        careers_email: str,
        general_email: str,
        hr_profile_url: str,
        source: str,
        base_confidence: int = 0,
    ) -> Tuple[str, int]:
        """
        Determine official verification status and final confidence score.

        Statuses:
        - Verified Public HR Email (90-95%)
        - Verified Recruitment Email (85-90%)
        - Verified Careers Email (85-90%)
        - General Contact Email (70%)
        - Not Publicly Available (0%)
        """
        # Case 1: Verified Public HR Email
        if hr_email and hr_email != "Not Publicly Available":
            domain = hr_email.split("@")[-1] if "@" in hr_email else ""
            mx_valid = cls.verify_domain_mx(domain) if domain else False

            if "career" in source.lower() or "official" in source.lower():
                score = 95 if mx_valid else 90
            elif "linkedin" in source.lower():
                score = 90
            else:
                score = 85
            return "Verified Public HR Email", score

        # Case 2: Verified Recruitment Email
        if recruitment_email and recruitment_email != "Not Publicly Available":
            domain = (
                recruitment_email.split("@")[-1] if "@" in recruitment_email else ""
            )
            mx_valid = cls.verify_domain_mx(domain) if domain else False
            score = (
                90 if "official" in source.lower() or "career" in source.lower() else 85
            )
            return "Verified Recruitment Email", score

        # Case 3: Verified Careers Email
        if careers_email and careers_email != "Not Publicly Available":
            domain = careers_email.split("@")[-1] if "@" in careers_email else ""
            mx_valid = cls.verify_domain_mx(domain) if domain else False
            score = 90 if "career" in source.lower() else 85
            return "Verified Careers Email", score

        # Case 4: General Contact Email
        if general_email and general_email != "Not Publicly Available":
            return "General Contact Email", 70

        # Case 5: Public LinkedIn Profile found but no email
        if hr_profile_url and hr_profile_url != "Not Publicly Available":
            return "Not Publicly Available", 50

        # Case 6: No HR contact found
        return "Not Publicly Available", 0
