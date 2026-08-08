"""
LinkedIn Public Research module.
Locates publicly indexed HR Managers, Recruiters, and Talent Specialists for the target company
using public search snippets, team bios, structured metadata, and public indices.
Strictly collects only public data without fabricating or bypassing authentication.
"""
import re
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel


class PublicHRProfile(BaseModel):
    name: str
    job_title: str
    linkedin_profile_url: str
    source: str
    confidence: int  # 0 to 100


# HR / Recruiter target roles
HR_ROLE_KEYWORDS = [
    "Head of HR", "HR Director", "HR Manager", "Human Resources Manager",
    "Human Resources Director", "VP of People", "Chief People Officer",
    "Director of People", "Talent Acquisition Manager", "Talent Acquisition Lead",
    "Talent Acquisition Specialist", "Senior Recruiter", "Technical Recruiter",
    "Lead Recruiter", "Corporate Recruiter", "HR Executive", "Recruitment Lead",
    "Recruitment Specialist", "Talent Partner", "People Operations Manager",
    "People Operations Lead", "Hiring Manager", "HR Generalist",
    "Human Resources Business Partner", "HRBP", "Recruitment Coordinator"
]


class LinkedInFinder:
    """Public LinkedIn HR profile locator."""

    @staticmethod
    def extract_hr_profiles_from_text(
        text: str,
        company_name: str,
        page_url: str = "",
        discovered_linkedin_urls: Optional[List[str]] = None
    ) -> List[PublicHRProfile]:
        """
        Extract publicly declared HR personnel from crawled team/about/leadership text and schema.
        """
        profiles: List[PublicHRProfile] = []
        discovered_urls = discovered_linkedin_urls or []

        # Find names associated with HR job titles in page text
        for role in HR_ROLE_KEYWORDS:
            # Pattern: Name - Role or Role: Name or Name, Role
            patterns = [
                re.compile(rf"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){{1,2}})\s*(?:[-–—|•,]\s*|\s+is\s+(?:the\s+)?|\s+at\s+{re.escape(company_name)}\s+)?\s*{re.escape(role)}", re.IGNORECASE),
                re.compile(rf"{re.escape(role)}\s*(?:[-–—|•,:]\s*|\s+at\s+{re.escape(company_name)}\s+)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){{1,2}})", re.IGNORECASE),
            ]

            for pat in patterns:
                for match in pat.finditer(text):
                    candidate_name = match.group(1).strip()
                    if LinkedInFinder._is_valid_person_name(candidate_name, company_name):
                        # Match with discovered LinkedIn profile URL if available
                        matched_url = "Not Publicly Available"
                        for li_url in discovered_urls:
                            if "/in/" in li_url:
                                name_slug = candidate_name.lower().replace(" ", "-")
                                if name_slug in li_url.lower() or candidate_name.split()[0].lower() in li_url.lower():
                                    matched_url = li_url
                                    break

                        profiles.append(PublicHRProfile(
                            name=candidate_name,
                            job_title=role,
                            linkedin_profile_url=matched_url,
                            source=page_url or "Company Public Team Page",
                            confidence=90 if matched_url != "Not Publicly Available" else 80
                        ))

        return profiles

    @staticmethod
    def parse_public_search_snippet(
        title: str,
        snippet: str,
        profile_url: str,
        company_name: str
    ) -> Optional[PublicHRProfile]:
        """
        Parse a public search engine snippet for a LinkedIn profile.
        E.g. Title: "Jane Doe - Senior Technical Recruiter - Aspire Softserv | LinkedIn"
             Snippet: "Ahmedabad, Gujarat, India · Senior Technical Recruiter · Aspire Softserv"
        """
        if "linkedin.com/in/" not in profile_url.lower():
            return None

        # Clean title
        clean_title = title.replace(" - LinkedIn", "").replace(" | LinkedIn", "").strip()
        parts = re.split(r"\s*[-–—|•]\s*", clean_title)

        name = ""
        job_title = ""

        if len(parts) >= 2:
            name = parts[0].strip()
            potential_title = parts[1].strip()

            # Check if title matches HR keywords
            for role in HR_ROLE_KEYWORDS:
                if role.lower() in potential_title.lower() or role.lower() in snippet.lower():
                    job_title = role if role.lower() in potential_title.lower() else potential_title
                    break
        elif len(parts) == 1:
            name = parts[0].strip()
            for role in HR_ROLE_KEYWORDS:
                if role.lower() in snippet.lower():
                    job_title = role
                    break

        if name and job_title and LinkedInFinder._is_valid_person_name(name, company_name):
            # Clean profile url
            clean_url = profile_url.split("?")[0].rstrip("/")
            return PublicHRProfile(
                name=name,
                job_title=job_title,
                linkedin_profile_url=clean_url,
                source=f"Public LinkedIn Index ({clean_url})",
                confidence=90
            )

        return None

    @staticmethod
    def _is_valid_person_name(name: str, company_name: str) -> bool:
        """Filter out non-person words or company names."""
        if not name or len(name) < 3 or len(name) > 40:
            return False

        # Ignore if name is equal to company name or contains digits
        if any(char.isdigit() for char in name):
            return False
        if company_name.lower() in name.lower() or name.lower() in company_name.lower():
            return False

        # Common stop words
        blacklisted = {
            "about us", "contact us", "careers", "our team", "leadership team",
            "privacy policy", "terms of service", "home page", "learn more",
            "read more", "view profile", "apply now", "get started", "we are hiring",
            "all rights reserved", "linkedin profile", "company page"
        }
        if name.lower() in blacklisted:
            return False

        words = name.split()
        if len(words) < 2 or len(words) > 4:
            return False

        return True
