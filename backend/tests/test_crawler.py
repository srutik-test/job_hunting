"""Crawler extraction tests – parse realistic page content offline."""

import pytest

from app.services.crawler.http_crawler import HttpCrawler, valid_email_candidate
from app.services.crawler.page_classifier import (
    classify_page_type,
    get_url_crawl_priority,
    is_internal_url,
)
from app.services.extraction.people import persons_from_jsonld, persons_from_text

HTML = """
<html><head>
<title>Contact AlphaTech Careers</title>
<meta name="description" content="Reach AlphaTech HR and recruiting team">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Person","name":"Jane Doe",
 "jobTitle":"Talent Acquisition Manager","email":"jane.doe@alphatech.io"}
</script>
</head><body>
<nav><a href="/careers">Careers</a><a href="/team">Our Team</a></nav>
<p>For recruitment queries contact
  <a href="mailto:hr@alphatech.io">hr@alphatech.io</a> or our
  <a href="mailto:careers@alphatech.io">careers mailbox</a>.<br/>
  General help: <a href="mailto:support@alphatech.io">support</a>
</p>
<p>Obfuscated: recruitment.team [at] alphatech [dot] io</p>
<a href="https://www.linkedin.com/in/janedoe-alphatech?trk=xyz">Jane on LinkedIn</a>
<a href="https://facebook.com/alphatech">Facebook</a>
</body></html>
"""


def test_page_classification():
    assert classify_page_type("https://x.com/careers/open-roles") == "careers"
    assert classify_page_type("https://x.com/contact-us") == "contact"
    assert classify_page_type("https://x.com/our-team") == "team"
    assert classify_page_type("https://x.com/blog/post-1") == "blog"
    assert classify_page_type("https://x.com/") == "general"


def test_internal_url_domain_restriction():
    assert is_internal_url("acme.com", "https://acme.com/team")
    assert is_internal_url("acme.com", "https://jobs.acme.com/roles")
    assert is_internal_url("acme.com", "https://www.acme.com/about")
    assert not is_internal_url("acme.com", "https://other.com/x")
    assert not is_internal_url("acme.com", "https://evil-acme.com/x")


def test_crawl_priority():
    assert get_url_crawl_priority("https://x.com/careers") > get_url_crawl_priority(
        "https://x.com/blog/x"
    )
    assert get_url_crawl_priority("https://x.com/logo.png") == -1


def test_valid_email_filtering():
    assert valid_email_candidate("hr@alphatech.io")
    assert not valid_email_candidate("u12345@alphatech.sentry.io")
    assert not valid_email_candidate("image@2x.png")
    assert not valid_email_candidate("name@example.com")
    assert not valid_email_candidate("a@b")


def test_full_page_parse_extracts_real_emails_only():
    crawler = HttpCrawler()
    page = crawler._parse_page(
        "https://alphatech.io/contact", 200, HTML, "alphatech.io"
    )
    emails = set(page.emails)

    assert "hr@alphatech.io" in emails  # mailto extraction
    assert "careers@alphatech.io" in emails
    assert "jane.doe@alphatech.io" in emails  # JSON-LD extraction
    assert "recruitment.team@alphatech.io" in emails  # obfuscation handling
    assert "support@alphatech.io" in emails  # extracted but generic

    # LinkedIn captured without tracking params
    assert any("linkedin.com/in/janedoe" in u for u in page.linkedin_urls)
    assert not any("trk=" in u for u in page.linkedin_urls)

    # context recorded for mailto emails
    contexts = {c["email"]: c["context"] for c in page.email_contexts}
    assert "recruitment" in contexts["hr@alphatech.io"].lower()


@pytest.mark.asyncio
async def test_person_identification_from_jsonld():
    crawler = HttpCrawler()
    page = crawler._parse_page(
        "https://alphatech.io/contact", 200, HTML, "alphatech.io"
    )
    persons = persons_from_jsonld(page.json_ld, page.url)
    assert any(
        p.name == "Jane Doe"
        and "Talent Acquisition" in p.job_title
        and p.email == "jane.doe@alphatech.io"
        for p in persons
    )


@pytest.mark.asyncio
async def test_person_identification_from_text():
    people = persons_from_text(
        "Our leadership team: Priya Sharma - HR Manager. Contact her on LinkedIn.",
        "AlphaTech",
        "https://alphatech.io/team",
        linkedin_urls=["https://linkedin.com/in/priya-sharma-aa"],
    )
    assert any(p.name == "Priya Sharma" for p in people)
    match = next(p for p in people if p.name == "Priya Sharma")
    assert match.job_title.lower() == "hr manager"
    assert match.linkedin_profile_url == "https://linkedin.com/in/priya-sharma-aa"


def test_linkedin_snippet_parser():
    from app.services.extraction.linkedin import parse_linkedin_snippet

    lead = parse_linkedin_snippet(
        "Jane Doe - Senior Technical Recruiter - AlphaTech | LinkedIn",
        "Ahmedabad, India · Senior Technical Recruiter · AlphaTech",
        "https://www.linkedin.com/in/jane-doe-a1b2c3?trk=xyz",
        "AlphaTech",
        "DuckDuckGo",
    )
    assert lead is not None
    assert lead.name == "Jane Doe"
    assert "Recruiter" in lead.job_title
    assert "trk" not in lead.linkedin_url

    # non-HR profiles are ignored
    assert (
        parse_linkedin_snippet(
            "John Smith - Software Engineer - AlphaTech | LinkedIn",
            "Backend dev",
            "https://www.linkedin.com/in/john-smith",
            "AlphaTech",
            "DuckDuckGo",
        )
        is None
    )
    # non-LinkedIn URLs are ignored
    assert (
        parse_linkedin_snippet(
            "Recruiter at AlphaTech",
            "",
            "https://alphatech.io/jobs",
            "AlphaTech",
            "DuckDuckGo",
        )
        is None
    )
