"""
High-value page classification & crawl prioritization.

This module classifies web pages based on their URL and content
to determine which pages are most likely to contain HR contact information.

Key principles:
1. Certain page types are more likely to have HR contact info
2. Pages are prioritized based on their likely relevance to HR discovery
3. Non-HTML files and irrelevant pages are filtered out
"""

import re
from urllib.parse import urlparse

# =============================================================================
# Page type patterns with priorities
# Higher priority = more likely to contain HR contact information
# =============================================================================
PAGE_PATTERNS = {
    # Highest priority: HR-specific pages
    "hr": (
        re.compile(
            r"(human[- ]?resources?|hr\b|hrop|hrdept|hrteam|hradmin|people[- ]ops|peopleoperations)",
            re.I,
        ),
        15,  # Highest priority
    ),
    # High priority: Recruitment/Talent pages
    "recruitment": (
        re.compile(
            r"(recruit|ment|recruiters?|talent[- ]?acquisition|talent[- ]?team|sourcing|staffing)",
            re.I,
        ),
        14,  # High priority
    ),
    # High priority: Careers pages
    "careers": (
        re.compile(
            r"(careers?|jobs?|hiring|openings|vacanc|work[- ]with[- ]us|join[- ](us|our[- ]team)|opportunities|employment)",
            re.I,
        ),
        13,  # High priority
    ),
    # High priority: Contact pages
    "contact": (
        re.compile(
            r"(contact|get[- ]in[- ]touch|reach[- ](us|out)|enqui|get in touch)",
            re.I,
        ),
        12,  # High priority
    ),
    # Medium priority: People/Team pages
    "people": (
        re.compile(
<<<<<<< HEAD
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
=======
            r"(people|team|our[- ]team|meet[- ]the[- ]team|our[- ]people)",
            re.I,
        ),
        10,  # Medium priority
    ),
    "team": (
        re.compile(
            r"(leadership|management|executives?|who[- ]we[- ]are|about[- ]us)",
            re.I,
        ),
        9,  # Medium priority
    ),
    # Lower priority: About/Sitemap pages
    "about": (
        re.compile(r"(about|company|overview|story)", re.I),
        7,  # Lower priority
    ),
    "sitemap": (
        re.compile(r"(sitemap|site[- ]map)", re.I),
        6,  # Lower priority - useful for discovery
    ),
    # Lowest priority: Utility pages
    "privacy": (
        re.compile(r"(privacy|terms|legal|impressum|policy)", re.I),
        3,  # Low priority - may have contact info
    ),
    "blog": (
        re.compile(r"(blog|news|press|insights|resources)", re.I),
        2,  # Low priority
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
    ),
}

# =============================================================================
# File extensions to IGNORE (not crawlable HTML)
# =============================================================================
IGNORE_EXTENSIONS = {
<<<<<<< HEAD
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
=======
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico",
    ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dmg", ".pkg",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm",
    ".css", ".js", ".json", ".xml", ".woff", ".woff2", ".ttf", ".eot",
    # Common CMS files
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
>>>>>>> 87b2665f6d2640797abd4693bfa359426fd13709
}


def classify_page_type(url: str, title: str = "", text_snippet: str = "") -> str:
    """
    Classify a page based on URL, title, and content snippet.
    
    Returns the most relevant page type for HR discovery.
    Higher priority patterns are checked first.
    """
    # Combine URL and title for classification
    combined = f"{url.lower()} {title.lower()}"
    
    # Track highest priority match
    best_match = None
    best_priority = -1
    
    for page_type, (regex, priority) in PAGE_PATTERNS.items():
        if regex.search(combined):
            if priority > best_priority:
                best_match = page_type
                best_priority = priority
    
    return best_match or "general"


def get_url_crawl_priority(url: str) -> int:
    """
    Calculate crawl priority for a URL.
    
    Higher priority = more likely to contain HR contact information.
    Returns -1 to skip the URL entirely.
    """
    parsed = urlparse(url)
    path = parsed.path.lower()
    
    # =================================================================
    # FILTER: Skip non-HTML files (except sitemap.xml)
    # =================================================================
    for ext in IGNORE_EXTENSIONS:
        if path.endswith(ext) and not path.endswith("sitemap.xml"):
            return -1
    
    # =================================================================
    # CALCULATE: Priority based on path matching
    # =================================================================
    best_priority = -1
    
    for page_type, (regex, priority) in PAGE_PATTERNS.items():
        if regex.search(path):
            if priority > best_priority:
                best_priority = priority
    
    # If no pattern matched, calculate based on path depth
    if best_priority == -1:
        segments = [s for s in path.split("/") if s]
        
        if not segments:
            # Root path
            return 10
        elif len(segments) == 1:
            # Top-level page (e.g., /about)
            return 7
        elif len(segments) == 2:
            # Second-level page (e.g., /about/team)
            return 5
        else:
            # Deeper pages - still crawl but lower priority
            return 3
    
    return best_priority


def is_internal_url(base_domain: str, candidate_url: str) -> bool:
    """
    True when the candidate URL stays on the company's own domain/subdomains.
    
    This prevents crawling external sites.
    """
    try:
        parsed = urlparse(candidate_url)
        cand_host = (parsed.netloc or "").lower().removeprefix("www.")
        if not cand_host:
            return True  # relative URL
        return (
            cand_host == base_domain
            or cand_host.endswith(f".{base_domain}")
        )
    except Exception:
        return False


def is_hr_relevant_page(page_type: str) -> bool:
    """
    Check if a page type is likely to contain HR contact information.
    
    Returns True for pages that are worth crawling for HR discovery.
    """
    hr_relevant_types = {
        "hr", "recruitment", "careers", "contact", "people", "team", "about"
    }
    return page_type in hr_relevant_types


def should_follow_link(url: str, page_type: str) -> bool:
    """
    Determine if a link should be followed for HR discovery.
    
    Rules:
    1. HR-relevant pages should always be followed
    2. Blog/news pages can be followed but are lower priority
    3. Utility pages (privacy, sitemap) may contain contact info
    4. Skip asset files and non-HTML content
    """
    # Quick check using page type
    if is_hr_relevant_page(page_type):
        return True
    
    # Check for ignored extensions
    parsed = urlparse(url)
    path = parsed.path.lower()
    
    for ext in IGNORE_EXTENSIONS:
        if path.endswith(ext):
            return False
    
    # Check for blog/news which are lower priority
    blog_pattern = re.compile(r"(blog|news|press|insights|resources)", re.I)
    if blog_pattern.search(path):
        return True  # Follow but with low priority
    
    # Default: follow
    return True
