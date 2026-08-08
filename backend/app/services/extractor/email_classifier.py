"""
Email Classifier module.
Classifies publicly discovered emails into HR, Recruitment, Careers, Talent Acquisition,
and General Contact, while filtering out non-HR generic mailboxes.
"""

import re
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel

# Pre-compiled email extraction regex for high-speed scanning
EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", re.IGNORECASE
)


class CategorizedEmail(BaseModel):
    email: str
    category: str  # HR, Recruitment, Careers, Talent Acquisition, People Operations, General Contact
    source_url: str
    is_generic: bool
    confidence_weight: int  # 0 to 100


# Keywords indicating HR and Talent Acquisition intent in local-part (prefix)
HR_PATTERNS = {
    "HR": [
        "hr",
        "humanresources",
        "human.resources",
        "human_resources",
        "hroffice",
        "hrteam",
        "hr.team",
        "hrdept",
        "people",
        "peopleops",
        "people.operations",
    ],
    "Recruitment": [
        "recruitment",
        "recruiting",
        "recruiter",
        "recruit",
        "recruiters",
        "recruitmentteam",
        "talent",
        "talentacquisition",
        "talent.acquisition",
        "talents",
        "staffing",
    ],
    "Careers": [
        "careers",
        "career",
        "jobs",
        "job",
        "hiring",
        "work",
        "joinus",
        "join",
        "apply",
        "opportunities",
        "employment",
        "openings",
    ],
    "Talent Acquisition": [
        "talentacquisition",
        "ta",
        "talent.lead",
        "talentpartner",
        "talent-lead",
        "talent-acquisition",
    ],
    "People Operations": [
        "peopleops",
        "people.ops",
        "peopleoperations",
        "people_ops",
        "culture",
        "peopleteam",
    ],
}

# Generic prefixes to filter out from HR classifications
GENERIC_PREFIXES = {
    "info",
    "support",
    "admin",
    "sales",
    "contact",
    "hello",
    "marketing",
    "finance",
    "accounts",
    "billing",
    "press",
    "media",
    "help",
    "enquiry",
    "inquiry",
    "feedback",
    "service",
    "office",
    "frontdesk",
    "inbox",
    "general",
    "team",
    "webmaster",
    "postmaster",
    "hostmaster",
    "security",
}


def classify_email(
    email: str, page_type: str = "general", source_url: str = ""
) -> CategorizedEmail:
    """
    Classify discovered email into HR/Recruitment/Careers or General Contact.
    """
    email_clean = email.strip().lower()
    local_part = email_clean.split("@")[0] if "@" in email_clean else email_clean

    # Clean punctuation from local part (e.g. hr-team -> hrteam)
    local_clean = local_part.replace(".", "").replace("-", "").replace("_", "")

    # Check for direct HR keywords
    for cat, keywords in HR_PATTERNS.items():
        for kw in keywords:
            kw_clean = kw.replace(".", "").replace("-", "").replace("_", "")
            if (
                kw_clean == local_clean
                or local_clean.startswith(kw_clean)
                or local_clean.endswith(kw_clean)
            ):
                weight = (
                    95
                    if "career" in source_url.lower() or "job" in source_url.lower()
                    else 90
                )
                return CategorizedEmail(
                    email=email_clean,
                    category=cat,
                    source_url=source_url,
                    is_generic=False,
                    confidence_weight=weight,
                )

    # Check if page where email was found is a career/job page
    if page_type in ("careers", "jobs", "hiring"):
        return CategorizedEmail(
            email=email_clean,
            category="Careers",
            source_url=source_url,
            is_generic=False,
            confidence_weight=90,
        )

    # Check if generic prefix
    if local_part in GENERIC_PREFIXES or any(
        local_part.startswith(g) for g in GENERIC_PREFIXES
    ):
        return CategorizedEmail(
            email=email_clean,
            category="General Contact",
            source_url=source_url,
            is_generic=True,
            confidence_weight=70,
        )

    # If it is a personal mailbox like john.doe@company.com found on a Team / People page
    if page_type in ("team", "leadership", "people"):
        return CategorizedEmail(
            email=email_clean,
            category="People Operations",
            source_url=source_url,
            is_generic=False,
            confidence_weight=80,
        )

    # Default fallback
    return CategorizedEmail(
        email=email_clean,
        category="General Contact",
        source_url=source_url,
        is_generic=True,
        confidence_weight=65,
    )


def select_best_contacts(
    categorized_emails: List[CategorizedEmail],
) -> Tuple[str, str, str, str, str, int]:
    """
    Select the highest confidence emails for each specific category:
    Returns (hr_email, recruitment_email, careers_email, general_email, best_source, confidence_score)
    """
    hr_email = "Not Publicly Available"
    recruitment_email = "Not Publicly Available"
    careers_email = "Not Publicly Available"
    general_email = "Not Publicly Available"
    best_source = "Not Publicly Available"
    confidence_score = 0

    if not categorized_emails:
        return (
            hr_email,
            recruitment_email,
            careers_email,
            general_email,
            best_source,
            0,
        )

    # Sort categorized emails by confidence weight descending
    sorted_emails = sorted(
        categorized_emails, key=lambda x: x.confidence_weight, reverse=True
    )

    for item in sorted_emails:
        if (
            item.category in ("HR", "People Operations")
            and hr_email == "Not Publicly Available"
        ):
            hr_email = item.email
            if confidence_score < item.confidence_weight:
                confidence_score = item.confidence_weight
                best_source = item.source_url or "Official Company Website"

        elif (
            item.category in ("Recruitment", "Talent Acquisition")
            and recruitment_email == "Not Publicly Available"
        ):
            recruitment_email = item.email
            if confidence_score < item.confidence_weight:
                confidence_score = item.confidence_weight
                best_source = item.source_url or "Official Careers Portal"

        elif item.category == "Careers" and careers_email == "Not Publicly Available":
            careers_email = item.email
            if confidence_score < item.confidence_weight:
                confidence_score = item.confidence_weight
                best_source = item.source_url or "Official Careers Page"

        elif item.is_generic and general_email == "Not Publicly Available":
            general_email = item.email

    # If no HR/Recruitment/Careers email was found, fall back to general contact email
    if (
        hr_email == "Not Publicly Available"
        and recruitment_email == "Not Publicly Available"
        and careers_email == "Not Publicly Available"
    ):
        if general_email != "Not Publicly Available":
            confidence_score = 70
            # Find source of general email
            gen_item = next(
                (i for i in sorted_emails if i.email == general_email), None
            )
            best_source = (
                gen_item.source_url
                if gen_item and gen_item.source_url
                else "Official Contact Page"
            )
        else:
            confidence_score = 0
            best_source = "Not Publicly Available"

    return (
        hr_email,
        recruitment_email,
        careers_email,
        general_email,
        best_source,
        confidence_score,
    )
