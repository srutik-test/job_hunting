"""
Person identification from crawled pages.

Finds HR/recruitment people explicitly declared on company pages:
  * JSON-LD schema.org Person entries with HR job titles
  * "Name – Talent Acquisition Manager" style mentions in team/careers text
  * personal email addresses near HR role context

Never fabricates: a person is only returned when the page itself states
their name/title (or a mailbox exists).
"""

import re
from typing import List, Optional
from pydantic import BaseModel

HR_ROLE_KEYWORDS = [
    "Head of HR",
    "Head of People",
    "HR Director",
    "HR Manager",
    "Human Resources Manager",
    "Human Resources Director",
    "Human Resources",
    "VP of People",
    "Chief People Officer",
    "Director of People",
    "Talent Acquisition Manager",
    "Talent Acquisition Lead",
    "Talent Acquisition Specialist",
    "Talent Acquisition",
    "Talent Partner",
    "Senior Recruiter",
    "Technical Recruiter",
    "Lead Recruiter",
    "Corporate Recruiter",
    "Recruiter",
    "Recruitment Manager",
    "Recruitment Lead",
    "Recruitment Specialist",
    "Recruitment Coordinator",
    "HR Executive",
    "HR Generalist",
    "HR Business Partner",
    "HRBP",
    "People Operations Manager",
    "People Operations Lead",
    "People Operations",
    "Hiring Manager",
]
_ROLE_RE = re.compile("|".join(re.escape(r) for r in HR_ROLE_KEYWORDS), re.I)

_NAME_RE = r"([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){1,2})"


class DiscoveredPerson(BaseModel):
    name: str
    job_title: str
    source_url: str = ""
    linkedin_profile_url: Optional[str] = None
    email: Optional[str] = None  # only when present on the page/near context
    phone: Optional[str] = None
    matched_via: str = "text"  # text | jsonld | email_context


_STOP_NAMES = {
    "about us",
    "contact us",
    "our team",
    "read more",
    "learn more",
    "apply now",
    "view all",
    "sign up",
    "log in",
    "get started",
}
# Words that signal a heading rather than a person when they appear inside a
# candidate name (e.g. "Leadership Jane Doe" extracted from a header).
_STOP_WORDS = {
    "leadership",
    "team",
    "teams",
    "management",
    "about",
    "contact",
    "careers",
    "our",
    "the",
    "welcome",
    "meet",
    "staff",
    "board",
    "join",
    "company",
    "overview",
    "people",
}


def _valid_name(name: str, company_name: str) -> bool:
    if not name or not (3 <= len(name) <= 40) or any(c.isdigit() for c in name):
        return False
    low = name.lower()
    if low in _STOP_NAMES:
        return False
    words = name.split()
    if any(w.lower() in _STOP_WORDS for w in words):
        return False
    if company_name and (company_name.lower() in low or low in company_name.lower()):
        return False
    return 2 <= len(words) <= 4


def persons_from_jsonld(
    json_ld: list, source_url: str, linkedin_urls: Optional[List[str]] = None
) -> List[DiscoveredPerson]:
    people: List[DiscoveredPerson] = []

    def walk(node):
        if isinstance(node, dict):
            ntype = node.get("@type", "")
            if (isinstance(ntype, str) and ntype.lower() == "person") or (
                isinstance(ntype, list) and "Person" in ntype
            ):
                name = (node.get("name") or "").strip()
                title = str(node.get("jobTitle") or "").strip()
                if name and _ROLE_RE.search(title or ""):
                    email = None
                    if isinstance(node.get("email"), str):
                        email = node["email"].strip().lower()
                    li = None
                    same_as = node.get("sameAs")
                    if isinstance(same_as, str):
                        same_as = [same_as]
                    if isinstance(same_as, list):
                        for u in same_as:
                            if isinstance(u, str) and "linkedin.com/in/" in u:
                                li = u
                    phone = None
                    if isinstance(node.get("telephone"), str):
                        phone = node["telephone"].strip()
                    elif isinstance(node.get("phone"), str):
                        phone = node["phone"].strip()
                    people.append(
                        DiscoveredPerson(
                            name=name,
                            job_title=title,
                            source_url=source_url,
                            linkedin_profile_url=li,
                            email=email,
                            phone=phone,
                            matched_via="jsonld",
                        )
                    )
            for v in node.values():
                if isinstance(v, (dict, list)):
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(json_ld)
    return people


def persons_from_text(
    text: str,
    company_name: str,
    source_url: str,
    linkedin_urls: Optional[List[str]] = None,
) -> List[DiscoveredPerson]:
    people: List[DiscoveredPerson] = []
    li_urls = linkedin_urls or []
    seen = set()

    patterns = [
        re.compile(rf"{_NAME_RE}\s*[-–—|,•]\s*({_ROLE_RE.pattern})", re.I),
        re.compile(rf"({_ROLE_RE.pattern})\s*[-–—|:•]\s*{_NAME_RE}", re.I),
    ]
    for pat in patterns:
        for m in pat.finditer(text):
            name, role = (
                (m.group(1), m.group(2))
                if pat is patterns[0]
                else (m.group(2), m.group(1))
            )
            name = name.strip()
            role = role.strip()
            key = (name.lower(), role.lower())
            if key in seen or not _valid_name(name, company_name):
                continue
            seen.add(key)
            li = None
            slug = name.lower().replace(" ", "-")
            for u in li_urls:
                if "/in/" in u and (
                    slug in u.lower() or name.split()[0].lower() in u.lower()
                ):
                    li = u
                    break
            people.append(
                DiscoveredPerson(
                    name=name,
                    job_title=role,
                    source_url=source_url,
                    linkedin_profile_url=li,
                    matched_via="text",
                )
            )
    return people
