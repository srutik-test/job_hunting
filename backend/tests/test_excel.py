"""
Unit tests for Excel/CSV import and export.
"""
import pytest
from app.services.excel.importer import ExcelImporter
from app.services.excel.exporter import ExcelExporter


def test_excel_template_generation_and_parse():
    xlsx_bytes = ExcelImporter.generate_sample_excel()
    assert len(xlsx_bytes) > 100

    companies, preview = ExcelImporter.parse_file(xlsx_bytes, "template.xlsx")
    assert len(companies) >= 5
    assert companies[0].name == "Aspire Softserv"
    assert "aspiresoftserv.com" in companies[0].website
    assert preview.valid_count >= 5
    assert preview.invalid_count == 0


def test_csv_template_generation_and_parse():
    csv_str = ExcelImporter.generate_sample_csv()
    csv_bytes = csv_str.encode("utf-8")

    companies, preview = ExcelImporter.parse_file(csv_bytes, "template.csv")
    assert len(companies) >= 5
    assert companies[1].name == "Simform"
    assert preview.valid_count >= 5


def test_excel_export():
    sample_results = [
        {
            "company_name": "Aspire Softserv",
            "location": "Ahmedabad",
            "website": "https://aspiresoftserv.com",
            "linkedin_url": "https://linkedin.com/company/aspire-softserv",
            "hr_email": "careers@aspiresoftserv.com",
            "recruitment_email": "Not Publicly Available",
            "careers_email": "careers@aspiresoftserv.com",
            "general_email": "info@aspiresoftserv.com",
            "hr_name": "John Doe",
            "hr_position": "Lead HR Manager",
            "linkedin_profile": "https://linkedin.com/in/johndoe-hr",
            "source": "Official Careers Page",
            "confidence_score": 95,
            "status": "Verified Public HR Email",
            "created_at": "2026-08-07T12:00:00Z"
        }
    ]

    out_xlsx = ExcelExporter.export_to_excel(sample_results)
    assert len(out_xlsx) > 500

    out_csv = ExcelExporter.export_to_csv(sample_results)
    assert "Aspire Softserv" in out_csv
    assert "careers@aspiresoftserv.com" in out_csv
    assert "95%" in out_csv
