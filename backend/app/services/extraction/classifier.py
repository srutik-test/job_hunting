"""
HR context analysis.

Classifies emails *actually found* in crawled content by their relationship
to HR / recruitment. In particular it prevents generic addresses such as
support@company.com from being misreported as HR contacts.

It never invents addresses and never assigns verification confidence —
scoring happens later, based on evidence and verification outcomes.
"""

import re
from typing import List, Optional
from pydantic import BaseModel

# =============================================================================
# CRITICAL: Generic emails that are NEVER HR contacts
# These must NEVER be shown as HR results regardless of context
# =============================================================================
GENERIC_LOCAL_PARTS = frozenset({
    # Standard generic mailboxes
    "info", "support", "admin", "sales", "contact", "hello", "hi", "marketing",
    "finance", "accounts", "billing", "press", "media", "help", "enquiry",
    "inquiry", "feedback", "service", "office", "frontdesk", "inbox", "general",
    "webmaster", "postmaster", "security", "noreply", "no-reply", "mail",
    "customerservice", "it", "tech", "legal", "privacy", "abuse",
    # Variants with common separators
    "info-request", "support-request", "contact-us", "contactus",
    "sales-enquiry", "marketing-enquiry", "hello-team", "hello-world",
    "admin-office", "admin-team", "general-enquiry",
})

# =============================================================================
# HR-specific local parts - these are potentially HR but require evidence
# =============================================================================
HR_LOCAL_PARTS = frozenset({
    "hr", "humanresources", "hroffice", "hrteam", "hrdept", "hropes", "hradmin",
    "people", "peopleops", "peopleoperations", "peopleteam", "culture",
    "human-resources", "people-ops",
})

# =============================================================================
# Recruitment/talent acquisition local parts
# =============================================================================
RECRUIT_LOCAL_PARTS = frozenset({
    "recruitment", "recruiting", "recruiter", "recruit", "recruiters",
    "recruitmentteam", "talent", "talentacquisition", "talents", "talentsearch",
    "talentacquisitionteam", "staffing", "sourcing", "ta", "tateam",
    "talent-team", "recruitment-team", "recruiting-team",
})

# =============================================================================
# Careers/hiring local parts - these are often NOT personal HR contacts
# but may be legitimate recruitment addresses
# =============================================================================
CAREERS_LOCAL_PARTS = frozenset({
    "careers", "career", "jobs", "job", "hiring", "joinus", "join", "apply",
    "opportunities", "employment", "openings", "vacancies", "workwithus",
    "work-with-us", "join-us", "careers-at", "jobs-at",
})

# =============================================================================
# HR context terms in surrounding text - these add evidence weight
# =============================================================================
HR_CONTEXT_TERMS = re.compile(
    r"\b(hr\b|human resources|recruit\w*|talent acquisition|talent partner|"
    r"hiring|careers?|job openings?|work with us|join (our )?team|hr manager|"
    r"head of hr|people operations|hrbp|recruiter|talent acquisition manager|"
    r"human resource|talent specialist|people partner)\b",
    re.I,
)

# =============================================================================
# Page type boosts - certain page types provide stronger HR evidence
# =============================================================================
PAGE_TYPE_BOOST = {
    "careers": 2,   # Careers pages - moderate boost
    "people": 4,    # People/HR pages - strong boost
    "contact": 1,   # Contact pages - minimal boost
    "team": 3,      # Team pages - good boost for HR employees
    "about": 1,     # About pages - minimal boost
    "hr": 5,        # Dedicated HR pages - very strong boost
    "recruitment": 4,  # Recruitment pages - strong boost
    "leadership": 2,   # Leadership pages - moderate for HR execs
}

# =============================================================================
# Email candidate model
# =============================================================================
class EmailCandidate(BaseModel):
    email: str
    # hr | recruitment | careers | personal | generic | unknown
    relation: str
    is_generic: bool
    context_strength: int = 0   # 0-10 heuristic context signal, NOT a confidence score
    source_url: str = ""
    page_type: str = "general"
    context_snippet: str = ""


def _clean_local(email: str) -> str:
    """Remove common separators to get base local part."""
    local = email.split("@")[0] if "@" in email else email
    return re.sub(r"[.\-_+]", "", local).lower()


def _matches_vocabulary(local_clean: str, vocabulary: frozenset) -> bool:
    """Check if local part matches any vocabulary entry."""
    return (
        local_clean in vocabulary
        or any(local_clean.startswith(f"{kw}-") for kw in vocabulary)
        or any(local_clean.startswith(f"{kw}_") for kw in vocabulary)
        or any(local_clean.startswith(f"{kw}.") for kw in vocabulary)
    )


def _looks_personal(local: str) -> bool:
    """
    john.doe / jdoe style patterns are treated as personal mailboxes.
    Returns True if the email looks like a personal inbox.
    """
    parts = re.split(r"[.\-_]", local)
    parts = [p for p in parts if p]
    if len(parts) >= 2:
        alpha_parts = [p for p in parts if p.isalpha() and len(p) >= 2]
        return len(alpha_parts) >= 2
    # firstname+lastname concatenation
    return local.isalpha() and len(local) >= 6


def _has_hr_context(context: str) -> bool:
    """Check if context snippet contains HR-related terms."""
    if not context:
        return False
    # Clean and check context
    cleaned = " ".join(context.split())[:500]
    return bool(HR_CONTEXT_TERMS.search(cleaned))


def classify_email(
    email: str,
    page_type: str = "general",
    source_url: str = "",
    context: str = "",
) -> EmailCandidate:
    """
    Classify an email found in crawled content.
    
    IMPORTANT RULES:
    1. Generic emails (info@, support@, etc.) are NEVER HR contacts
    2. We NEVER fabricate or guess email addresses
    3. context_strength represents evidence, not confidence
    """
    email = email.strip().lower()
    local = email.split("@")[0] if "@" in email else email
    local_clean = _clean_local(email)
    
    relation = "unknown"
    is_generic = False
    context_strength = 0
    
    # =================================================================
    # STEP 1: Check if it's a known generic email (HIGHEST PRIORITY)
    # Generic emails are NEVER HR contacts
    # =================================================================
    if _matches_vocabulary(local_clean, GENERIC_LOCAL_PARTS):
        relation = "generic"
        is_generic = True
        context_strength = 0  # No evidence for HR
        
        return EmailCandidate(
            email=email,
            relation=relation,
            is_generic=is_generic,
            context_strength=context_strength,
            source_url=source_url,
            page_type=page_type,
            context_snippet=" ".join((context or "").split())[:240],
        )
    
    # =================================================================
    # STEP 2: Check for HR-specific local parts
    # =================================================================
    if _matches_vocabulary(local_clean, HR_LOCAL_PARTS):
        relation = "hr"
        context_strength += 4  # HR keyword in local part
    
    # =================================================================
    # STEP 3: Check for recruitment/talent acquisition local parts
    # =================================================================
    elif _matches_vocabulary(local_clean, RECRUIT_LOCAL_PARTS):
        relation = "recruitment"
        context_strength += 4  # Recruitment keyword in local part
    
    # =================================================================
    # STEP 4: Check for careers/hiring local parts
    # These are borderline - often general company addresses
    # =================================================================
    elif _matches_vocabulary(local_clean, CAREERS_LOCAL_PARTS):
        relation = "careers"
        context_strength += 2  # Careers keyword - weaker signal
    
    # =================================================================
    # STEP 5: Check for personal-style email addresses
    # =================================================================
    elif _looks_personal(local):
        relation = "personal"
        # Personal emails need strong context to be considered HR
    
    # =================================================================
    # STEP 6: Calculate total context strength
    # =================================================================
    
    # Base strength from relation type (already set above)
    # context_strength already includes relation keyword bonus
    
    # Check for HR context in surrounding text
    if _has_hr_context(context):
        context_strength += 3
    
    # Page type boost
    page_boost = PAGE_TYPE_BOOST.get(page_type.lower(), 0)
    context_strength += min(page_boost, 3)  # Cap page boost at 3
    
    # If it's a generic email on any page, context is 0
    if is_generic:
        context_strength = 0
    
    # =================================================================
    # Return the classified candidate
    # =================================================================
    return EmailCandidate(
        email=email,
        relation=relation,
        is_generic=is_generic,
        context_strength=min(context_strength, 10),  # Cap at 10
        source_url=source_url,
        page_type=page_type,
        context_snippet=" ".join((context or "").split())[:240],
    )


def is_hr_related(candidate: EmailCandidate) -> bool:
    """
    Determine if an email candidate is HR-related based on evidence.
    
    Requirements for HR classification:
    1. Must have relation in (hr, recruitment) OR
    2. Must have relation=careers with strong context (>= 5) OR
    3. Must have relation=personal with very strong context (>= 7)
    
    Generic emails are NEVER HR-related regardless of context.
    """
    if candidate.is_generic:
        return False
    
    if candidate.relation in ("hr", "recruitment"):
        # Strong HR keywords in local part - requires context >= 2
        return candidate.context_strength >= 2
    
    if candidate.relation == "careers":
        # Careers emails need strong supporting context
        return candidate.context_strength >= 5
    
    if candidate.relation == "personal":
        # Personal emails need very strong HR context to be considered
        return candidate.context_strength >= 7
    
    return False


def is_verified_hr_email(candidate: EmailCandidate, context_strength: int) -> bool:
    """
    Check if this email should be shown as a verified HR email.
    
    Requirements:
    1. Must be HR-related
    2. Must have strong enough context evidence (>= 4)
    3. Must NOT be a generic email
    """
    if candidate.is_generic:
        return False
    
    return is_hr_related(candidate) and context_strength >= 4
