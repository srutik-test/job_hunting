"""API-level tests: user isolation, dashboard, export, company management."""

import pytest

from tests.conftest import register_and_verify


@pytest.mark.asyncio
async def test_data_isolation_between_users(client):
    ac, Session = client
    await register_and_verify(ac, Session, email="one@example.com")

    resp = await ac.post(
        "/api/v1/searches",
        json={
            "companies": [{"name": "Isol Corp", "website": "https://isol.example.com"}],
        },
    )
    assert resp.status_code == 201
    search_id = resp.json()[0]["id"]

    await ac.post("/api/v1/auth/logout")
    await register_and_verify(ac, Session, email="two@example.com")

    # second user cannot see the first user's data
    assert (await ac.get(f"/api/v1/searches/{search_id}")).status_code == 404
    assert (await ac.get(f"/api/v1/searches/{search_id}/logs")).status_code == 404
    companies = (await ac.get("/api/v1/companies")).json()
    assert all(c["name"] != "Isol Corp" for c in companies)


@pytest.mark.asyncio
async def test_dashboard_stats_shape(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    resp = await ac.get("/api/v1/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    for key in (
        "total_companies",
        "total_searches",
        "verified_contacts",
        "searches_failed",
        "linkedin_profiles",
    ):
        assert key in data


@pytest.mark.asyncio
async def test_invalid_website_rejected(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    resp = await ac.post(
        "/api/v1/searches",
        json={
            "companies": [{"name": "Broken", "website": "::::"}],
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_rejects_bad_file(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    resp = await ac.post(
        "/api/v1/searches/upload",
        files={"file": ("bad.xlsx", b"not an excel", "application/vnd.ms-excel")},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_parses_csv_and_creates_searches(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    csv_content = (
        "Company Name,Location,Website\n"
        "Acme Ltd,Ahmedabad,https://acme.example.com\n"
        "Beta GmbH,Berlin,https://beta.example.de\n"
    ).encode()
    resp = await ac.post(
        "/api/v1/searches/upload",
        files={"file": ("companies.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    searches = resp.json()
    assert len(searches) == 2
    assert searches[0]["company"]["name"] in ("Acme Ltd", "Beta GmbH")


@pytest.mark.asyncio
async def test_excel_export_empty_returns_404(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    resp = await ac.get("/api/v1/export/excel")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sample_template_download(client):
    ac, Session = client
    await register_and_verify(ac, Session)
    resp = await ac.get("/api/v1/export/template")
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"  # xlsx zip signature


@pytest.mark.asyncio
async def test_contact_delete_and_bulk_delete(client):
    from app.models import Company, HRContact, Search

    ac, Session = client
    user = await register_and_verify(ac, Session)
    user_id = user["id"]

    async with Session() as session:
        comp = Company(name="TestCo", website="https://testco.example.com", user_id=user_id)
        session.add(comp)
        await session.flush()
        search = Search(company_id=comp.id, user_id=user_id, status="completed")
        session.add(search)
        await session.flush()
        c1 = HRContact(
            search_id=search.id,
            company_id=comp.id,
            user_id=user_id,
            email="hr1@testco.example.com",
            contact_category="verified_hr",
            confidence_score=95,
            source_type="company_website",
        )
        c2 = HRContact(
            search_id=search.id,
            company_id=comp.id,
            user_id=user_id,
            email="hr2@testco.example.com",
            contact_category="possible_hr",
            confidence_score=60,
            source_type="company_website",
        )
        session.add_all([c1, c2])
        await session.commit()
        c1_id, c2_id = c1.id, c2.id

    # List contacts
    resp = await ac.get("/api/v1/contacts")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Filter by min_confidence
    resp_conf = await ac.get("/api/v1/contacts?min_confidence=90")
    assert resp_conf.status_code == 200
    assert len(resp_conf.json()) == 1
    assert resp_conf.json()[0]["id"] == c1_id

    # Filtered export by category
    resp = await ac.get("/api/v1/export/excel?category=verified_hr&min_confidence=90")
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"

    # Filtered export by contact_ids
    resp = await ac.get(f"/api/v1/export/excel?contact_ids={c1_id}")
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"

    # Single delete c1
    del_resp = await ac.delete(f"/api/v1/contacts/{c1_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["ok"] is True

    # Check remaining
    contacts = (await ac.get("/api/v1/contacts")).json()
    assert len(contacts) == 1
    assert contacts[0]["id"] == c2_id

    # Bulk delete c2
    bulk_del = await ac.post("/api/v1/contacts/bulk-delete", json={"contact_ids": [c2_id]})
    assert bulk_del.status_code == 200
    assert bulk_del.json()["deleted_count"] == 1

    # Check empty
    assert len((await ac.get("/api/v1/contacts")).json()) == 0
