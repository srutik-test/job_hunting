"""
Page Classifier module.
Identifies and prioritizes high-value HR, recruitment, careers, and contact pages.
"""
import re
from urllib.parse import urlparse

# Priority weights for crawling queue
PAGE_PATTERNS = {
    "careers": (re.compile(r"(careers?|job|jobs|hiring|openings|vacancies|work-with-us|join-us|join-our-team|opportunities)", re.I), 10),
    "contact": (re.compile(r"(contact|contact-us|contactus|get-in-touch|reach-us|reach-out|touch)", re.I), 9),
    "people": (re.compile(r"(people|our-people|talent|human-resources|hr|staffing|recruiters?)", re.I), 9),
    "team": (re.compile(r"(team|our-team|leadership|management|executives?|about-us|about|who-we-are)", re.I), 8),
    "departments": (re.compile(r"(departments?|divisions?|offices?|locations?)", re.I), 6),
    "sitemap": (re.compile(r"(sitemap|sitemap\.xml|site-map)", re.I), 7),
    "privacy": (re.compile(r"(privacy|privacy-policy|terms|legal|impressum)", re.I), 5),
    "blog": (re.compile(r"(blog|news|press|insights)", re.I), 3),
}

# Negative patterns to avoid crawler traps or binary downloads
IGNORE_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico",
    ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dmg", ".pkg",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm",
    ".css", ".js", ".json", ".xml", ".woff", ".woff2", ".ttf", ".eot"
}


def classify_page_type(url: str, title: str = "", text_snippet: str = "") -> str:
    """Classify the page category based on URL path, title, and content."""
    url_lower = url.lower()
    title_lower = title.lower()
    combined = f"{url_lower} {title_lower}"

    for page_type, (regex, _) in PAGE_PATTERNS.items():
        if regex.search(combined):
            return page_type

    return "general"


def get_url_crawl_priority(url: str) -> int:
    """Calculate the priority for URL crawling (higher = crawl first)."""
    parsed = urlparse(url)
    path = parsed.path.lower()

    # Check extension
    for ext in IGNORE_EXTENSIONS:
        if path.endswith(ext) and not path.endswith("sitemap.xml"):
            return -1  # Skip

    for page_type, (regex, priority) in PAGE_PATTERNS.items():
        if regex.search(path):
            return priority

    # Homepage or shallow path
    segments = [s for s in path.split("/") if s]
    if len(segments) == 0:
        return 10  # Homepage is high priority
    elif len(segments) == 1:
        return 5
    elif len(segments) == 2:
        return 4
    else:
        return 2


def is_internal_url(base_domain: str, candidate_url: str) -> bool:
    """Check if candidate URL belongs to the same base domain or subdomain."""
    try:
        parsed_base = urlparse(base_domain if "://" in base_domain else f"https://{base_domain}")
        parsed_cand = urlparse(candidate_url)

        base_host = (parsed_base.netloc or "").lower().replace("www.", "")
        cand_host = (parsed_cand.netloc or "").lower().replace("www.", "")

        if not cand_host:
            return True  # Relative link
        return cand_host == base_host or cand_host.endswith(f".{base_host}")
    except Exception:
        return False
