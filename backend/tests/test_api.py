"""
Integration tests for FastAPI endpoints using TestClient.
"""

import pytest
from starlette.testclient import TestClient
from app.main import app
from app.services.excel.importer import ExcelImporter


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["features"]["recursive_crawler"] is True


def test_stats_endpoint(client):
    response = client.get("/api/v1/jobs/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_jobs" in data
    assert "total_verified_hr_emails" in data


def test_sample_template_downloads(client):
    res_xlsx = client.get("/api/v1/export/sample-template")
    assert res_xlsx.status_code == 200
    assert len(res_xlsx.content) > 100

    res_csv = client.get("/api/v1/export/sample-csv")
    assert res_csv.status_code == 200
    assert "Aspire Softserv" in res_csv.text


def test_manual_start_extraction(client):
    payload = {
        "companies": [
            {
                "name": "Aspire Softserv",
                "location": "Ahmedabad",
                "website": "https://aspiresoftserv.com",
                "linkedin_url": "https://linkedin.com/company/aspire-softserv",
            }
        ],
        "crawler_engine": "auto",
        "enable_public_search": False,
        "max_pages_per_company": 5,
    }
    response = client.post("/api/v1/companies/manual-start", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["total_companies"] == 1


def test_upload_preview_endpoint(client):
    sample_csv = ExcelImporter.generate_sample_csv().encode("utf-8")
    files = {"file": ("test.csv", sample_csv, "text/csv")}
    response = client.post("/api/v1/companies/upload-preview", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["valid_count"] >= 5
    assert "Company Name" in data["detected_columns"]
