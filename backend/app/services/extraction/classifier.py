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

HR_LOCAL_PARTS = {
    "hr", "humanresources", "hroffice", "hrteam", "hrdept", "hropes", "hradmin",
    "people", "peopleops", "peopleoperations", "peopleteam", "culture",
}
RECRUIT_LOCAL_PARTS = {
    "recruitment", "recruiting", "recruiter", "recruit", "recruiters",
    "recruitmentteam", "talent", "talentacquisition", "talents", "talentsearch",
    "talentacquisitionteam", "staffing", "sourcing", "ta", "tateam",
}
CAREERS_LOCAL_PARTS = {
    "careers", "career", "jobs", "job", "hiring", "joinus", "join", "apply",
    "opportunities", "employment", "openings", "vacancies", "workwithus",
}
GENERIC_LOCAL_PARTS = {
    "info", "support", "admin", "sales", "contact", "hello", "hi", "marketing",
    "finance", "accounts", "billing", "press", "media", "help", "enquiry",
    "inquiry", "feedback", "service", "office", "frontdesk", "inbox", "general",
    "webmaster", "postmaster", "security", "noreply", "no-reply", "mail",
    "customerservice", "it", "tech", "legal", "privacy", "abuse",
}

HR_CONTEXT_TERMS = re.compile(
    r"\b(hr\b|human resources|recruit\w*|talent acquisition|talent partner|"
    r"hiring|careers?|job openings?|work with us|join (our )?team|hr manager|"
    r"head of hr|people operations|hrbp|recruiter)\b",
    re.I,
)
PAGE_TYPE_BOOST = {"careers": 3, "people": 3, "contact": 2, "team": 2, "about": 1}


class EmailCandidate(BaseModel):
    email: str
    # hr | recruitment | careers | personal | generic | unknown
    relation: str
    is_generic: bool
    context_strength: int = 0   # 0-5 heuristic context signal, NOT a confidence score
    source_url: str = ""
    page_type: str = "general"
    context_snippet: str = ""


def _clean_local(email: str) -> str:
    local = email.split("@")[0] if "@" in email else email
    return re.sub(r"[.\-_+]", "", local)


def _looks_personal(local: str) -> bool:
    """john.doe / jdoe style patterns are treated as personal mailboxes."""
    parts = re.split(r"[.\-_]", local)
    parts = [p for p in parts if p]
    if len(parts) >= 2:
        alpha_parts = [p for p in parts if p.isalpha() and len(p) >= 2]
        return len(alpha_parts) >= 2
    # firstname+lastname concatenation is hard to detect reliably – treat as personal
    return local.isalpha() and len(local) >= 6


def classify_email(
    email: str,
    page_type: str = "general",
    source_url: str = "",
    context: str = "",
) -> EmailCandidate:
    email = email.strip().lower()
    local = email.split("@")[0] if "@" in email else email
    local_clean = _clean_local(email)
    context = context or ""

    relation = "unknown"
    is_generic = False

    def _matches(vocabulary) -> bool:
        return any(
            local_clean == kw or local_clean.startswith(kw) or local_clean.endswith(kw)
            for kw in vocabulary
        )

    if _matches(HR_LOCAL_PARTS):
        relation = "hr"
    elif _matches(RECRUIT_LOCAL_PARTS):
        relation = "recruitment"
    elif _matches(CAREERS_LOCAL_PARTS):
        relation = "careers"
    elif any(local == g or local_clean.startswith(g) for g in GENERIC_LOCAL_PARTS):
        relation = "generic"
        is_generic = True
    elif _looks_personal(local):
        relation = "personal"

    # ---- context strength: evidence in the surrounding text & page type
    strength = 0
    if relation in ("hr", "recruitment", "careers"):
        strength += 3
    if HR_CONTEXT_TERMS.search(" ".join(context.split())[:500]):
        strength += 2
    strength += min(PAGE_TYPE_BOOST.get(page_type, 0), 2)
    if is_generic:
        strength = 0

    # Generic emails on careers pages still aren't HR contacts – only the page
    # is HR. They surface as 'company_email' to the user.
    return EmailCandidate(
        email=email,
        relation=relation,
        is_generic=is_generic,
        context_strength=strength,
        source_url=source_url,
        page_type=page_type,
        context_snippet=" ".join(context.split())[:240],
    )


def is_hr_related(candidate: EmailCandidate) -> bool:
    return candidate.relation in ("hr", "recruitment", "careers") or (
        candidate.relation == "personal" and candidate.context_strength >= 4
    )
