"""
End-to-end pipeline tests with a fake website served by an in-process ASGI
test app. The crawler runs against a local WSGI-free httpx mock transport –
no external network is touched.
"""

import asyncio

import pytest
import pytest_asyncio
from httpx import MockTransport, Response

from app.services.crawler.base import CrawlResult
from tests.conftest import register_and_verify


CONTACT_HTML = b"""
<html><head><title>Contact - BetaWorks Careers</title></head><body>
<p>For recruitment enquiries email <a href="mailto:hr@betaworks.io">hr@betaworks.io</a>
or <a href="mailto:careers@betaworks.io">careers@betaworks.io</a>.</p>
<p>Support: <a href="mailto:support@betaworks.io">support@betaworks.io</a></p>
</body></html>
"""


def _mock_transport(handler):
    return MockTransport(handler)


@pytest.mark.asyncio
async def test_orchestrator_finds_real_hr_email(client, monkeypatch):
    from app.services.orchestrator import SearchOrchestrator
    from app.services.providers.base import CapabilityProvider, TestResult

    # Build a CrawlResult from parsed HTML instead of doing network I/O.
    from app.services.crawler.http_crawler import HttpCrawler

    crawler = HttpCrawler()
    page = crawler._parse_page(
        "https://betaworks.io/contact", 200, CONTACT_HTML.decode(), "betaworks.io")

    class FakeCrawler(CapabilityProvider):
        key = "fake_crawl"
        display_name = "Fake test crawler"
        capabilities = ["crawler"]
        is_free = True
        requires_api_key = False

        async def test_connection(self, api_key=None):
            return TestResult(ok=True, message="fake ok")

        async def crawl_company(self, base_url, company_name="",
                                progress_callback=None):
            return CrawlResult(
                base_url="https://betaworks.io", base_domain="betaworks.io",
                pages=[page], pages_crawled=1,
                all_emails=set(page.emails), duration_seconds=0.1,
                engine="fake",
            )

    async def fake_verify(email):
        from app.services.verification.email_verifier import VerificationLevel
        return VerificationLevel.MX_OK

    from app.services.providers.base import ProviderRegistry

    monkeypatch.setitem(ProviderRegistry._providers, "http_crawler", FakeCrawler())
    monkeypatch.setattr(
        "app.services.orchestrator.verify_email_local", fake_verify)

    await register_and_verify(client[0], client[1])
    resp = await client[0].post("/api/v1/searches", json={
        "companies": [{"name": "BetaWorks", "website": "https://betaworks.io"}],
    })
    assert resp.status_code == 201, resp.text
    search_id = resp.json()[0]["id"]

    # wait for the background worker to finish
    for _ in range(60):
        await asyncio.sleep(0.5)
        res = await client[0].get(f"/api/v1/searches/{search_id}")
        if res.json()["status"] in ("completed", "no_results", "failed"):
            break

    res = await client[0].get(f"/api/v1/searches/{search_id}")
    data = res.json()
    assert data["status"] == "completed", data.get("error_message")

    contacts = (await client[0].get(
        f"/api/v1/searches/{search_id}/contacts")).json()
    emails = {c["email"]: c for c in contacts}

    # Real HR mailbox surfaced with evidence + source
    assert "hr@betaworks.io" in emails
    hr = emails["hr@betaworks.io"]
    assert hr["verification_status"] == "verified"
    assert hr["confidence_score"] >= 90
    assert hr["source_type"] == "company_website"
    assert "betaworks.io/contact" in hr["source_url"]
    assert hr["contact_category"] == "verified_hr"

    # support mailbox kept but clearly NOT an HR contact
    support = emails["support@betaworks.io"]
    assert support["contact_category"] == "company_email"

    # logs show a real progress trail
    logs = (await client[0].get(f"/api/v1/searches/{search_id}/logs")).json()
    joined = "\n".join(l["message"] for l in logs)
    assert "pages successfully crawled" in joined
    assert "email addresses extracted" in joined


@pytest.mark.asyncio
async def test_orchestrator_returns_no_results_when_site_has_no_hr(client, monkeypatch):
    from app.services.crawler.http_crawler import HttpCrawler
    from app.services.providers.base import CapabilityProvider, TestResult, ProviderRegistry
    from app.services.verification.email_verifier import VerificationLevel

    html = """
    <html><head><title>About - GammaCo</title></head><body>
    <p>Reach us at <a href="mailto:info@gammaco.io">info@gammaco.io</a> only.</p>
    </body></html>
    """
    crawler = HttpCrawler()
    page = crawler._parse_page("https://gammaco.io/about", 200, html, "gammaco.io")

    class FakeCrawler(CapabilityProvider):
        key = "fake_crawl2"
        display_name = "Fake"
        capabilities = ["crawler"]
        is_free = True
        requires_api_key = False

        async def test_connection(self, api_key=None):
            return TestResult(ok=True)

        async def crawl_company(self, base_url, company_name="",
                                progress_callback=None):
            return CrawlResult(
                base_url="https://gammaco.io", base_domain="gammaco.io",
                pages=[page], pages_crawled=1, all_emails=set(page.emails),
                engine="fake",
            )

    async def fake_verify(email):
        return VerificationLevel.MX_OK

    monkeypatch.setitem(ProviderRegistry._providers, "http_crawler", FakeCrawler())
    monkeypatch.setattr(
        "app.services.orchestrator.verify_email_local", fake_verify)

    await register_and_verify(client[0], client[1], email="g@example.com")
    resp = await client[0].post("/api/v1/searches", json={
        "companies": [{"name": "GammaCo", "website": "https://gammaco.io"}],
    })
    search_id = resp.json()[0]["id"]

    for _ in range(60):
        await asyncio.sleep(0.5)
        res = await client[0].get(f"/api/v1/searches/{search_id}")
        if res.json()["status"] in ("completed", "no_results", "failed"):
            break

    assert res.json()["status"] == "no_results"
    assert "No verified HR contact found" in res.json()["summary"]

    contacts = (await client[0].get(
        f"/api/v1/searches/{search_id}/contacts")).json()
    # a generic mailbox may appear, but never as HR.
    for c in contacts:
        assert c["contact_category"] == "company_email"
