"""
Parsing of public search-index snippets for LinkedIn profiles.
Only real snippets returned by configured search providers are parsed —
this module never guesses or constructs profile URLs.
"""

import re
from typing import Optional

from pydantic import BaseModel

from app.services.extraction.people import HR_ROLE_KEYWORDS

_ROLE_RE = re.compile("|".join(re.escape(r) for r in HR_ROLE_KEYWORDS), re.I)


class LinkedInLead(BaseModel):
    name: str
    job_title: str
    linkedin_url: str
    source: str  # e.g. 'DuckDuckGo public index snippet'
    source_url: str


def _valid_name(name: str, company_name: str) -> bool:
    if not name or not (3 <= len(name) <= 40) or any(c.isdigit() for c in name):
        return False
    low = name.lower()
    blacklist = {
        "about us",
        "contact us",
        "our team",
        "view profile",
        "apply now",
        "read more",
        "learn more",
        "linkedin profile",
    }
    if low in blacklist:
        return False
    if company_name and (company_name.lower() in low or low in company_name.lower()):
        return False
    return 2 <= len(name.split()) <= 4


def parse_linkedin_snippet(
    title: str, snippet: str, url: str, company_name: str, provider_name: str
) -> Optional[LinkedInLead]:
    """
    Parse a public search result like:
      title:   'Jane Doe - Talent Acquisition Manager - Acme Corp | LinkedIn'
      url:     https://www.linkedin.com/in/jane-doe-1a2b3c
    """
    if "linkedin.com/in/" not in url.lower():
        return None

    name = ""
    job_title = ""

    title_clean = re.split(r"\s[|｜]\sLinkedIn|\s-\sLinkedIn", title)[0].strip()
    parts = re.split(r"\s*[-–—|•]\s*", title_clean)
    if parts:
        name = parts[0].strip()
    for p in parts[1:]:
        m = _ROLE_RE.search(p)
        if m:
            job_title = m.group(0)
            break
    if not job_title:
        m = _ROLE_RE.search(snippet)
        if m:
            job_title = m.group(0)

    if not (name and job_title and _valid_name(name, company_name)):
        return None

    clean_url = url.split("?")[0].rstrip("/")
    return LinkedInLead(
        name=name,
        job_title=job_title.strip(),
        linkedin_url=clean_url,
        source=f"{provider_name} public index",
        source_url=clean_url,
    )
