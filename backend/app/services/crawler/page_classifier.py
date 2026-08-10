"""High-value page classification & crawl prioritization."""

import re
from urllib.parse import urlparse

PAGE_PATTERNS = {
    "careers": (
        re.compile(
            r"(careers?|jobs?|hiring|openings|vacanc|work[- ]with[- ]us|join[- ](us|our[- ]team)|opportunities|recruit)",
            re.I,
        ),
        12,
    ),
    "contact": (
        re.compile(r"(contact|get[- ]in[- ]touch|reach[- ](us|out)|enqui)", re.I),
        11,
    ),
    "people": (
        re.compile(
            r"(human[- ]resources|people[- ](ops|operations)|talent[- ](team|acquisition)|recruiters?|hr[- ]team)",
            re.I,
        ),
        11,
    ),
    "team": (
        re.compile(
            r"(team|our[- ]team|leadership|management|executives?|who[- ]we[- ]are)",
            re.I,
        ),
        9,
    ),
    "about": (re.compile(r"(about[- ]us|about)", re.I), 7),
    "sitemap": (re.compile(r"(sitemap|site[- ]map)", re.I), 7),
    "privacy": (re.compile(r"(privacy|terms|legal|impressum)", re.I), 4),
    "blog": (re.compile(r"(blog|news|press|insights)", re.I), 2),
}

IGNORE_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".exe",
    ".dmg",
    ".pkg",
    ".mp3",
    ".mp4",
    ".wav",
    ".avi",
    ".mov",
    ".webm",
    ".css",
    ".js",
    ".json",
    ".xml",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
}


def classify_page_type(url: str, title: str = "", text_snippet: str = "") -> str:
    combined = f"{url.lower()} {title.lower()}"
    for page_type, (regex, _) in PAGE_PATTERNS.items():
        if regex.search(combined):
            return page_type
    return "general"


def get_url_crawl_priority(url: str) -> int:
    parsed = urlparse(url)
    path = parsed.path.lower()

    for ext in IGNORE_EXTENSIONS:
        if path.endswith(ext) and not path.endswith("sitemap.xml"):
            return -1

    for page_type, (regex, priority) in PAGE_PATTERNS.items():
        if regex.search(path):
            return priority

    segments = [s for s in path.split("/") if s]
    if not segments:
        return 10
    if len(segments) == 1:
        return 5
    if len(segments) == 2:
        return 4
    return 2


def is_internal_url(base_domain: str, candidate_url: str) -> bool:
    """True when the candidate URL stays on the company's own domain/subdomains."""
    try:
        parsed = urlparse(candidate_url)
        cand_host = (parsed.netloc or "").lower().removeprefix("www.")
        if not cand_host:
            return True  # relative
        return cand_host == base_domain or cand_host.endswith(f".{base_domain}")
    except Exception:
        return False
