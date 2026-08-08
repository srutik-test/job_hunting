"""
Export endpoints: Excel (.xlsx) and CSV downloads, sample import template generation.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.result import ExtractionResult
from app.services.excel.importer import ExcelImporter
from app.services.excel.exporter import ExcelExporter

router = APIRouter(prefix="/export", tags=["Export & Templates"])


@router.get("/excel")
async def export_results_excel(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    min_confidence: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Download verified results as a professionally formatted Excel (.xlsx) workbook.
    """
    stmt = select(ExtractionResult)
    if job_id:
        stmt = stmt.where(ExtractionResult.job_id == job_id)
    if status and status != "all":
        stmt = stmt.where(ExtractionResult.status == status)
    if min_confidence is not None:
        stmt = stmt.where(ExtractionResult.confidence_score >= min_confidence)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            (ExtractionResult.company_name.ilike(term))
            | (ExtractionResult.website.ilike(term))
        )

    res = await db.execute(stmt)
    results = [item.to_dict() for item in res.scalars().all()]

    excel_bytes = ExcelExporter.export_to_excel(results)
    filename = f"hr_contacts_export_{len(results)}_records.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/csv")
async def export_results_csv(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Download verified results as a CSV file.
    """
    stmt = select(ExtractionResult)
    if job_id:
        stmt = stmt.where(ExtractionResult.job_id == job_id)
    if status and status != "all":
        stmt = stmt.where(ExtractionResult.status == status)

    res = await db.execute(stmt)
    results = [item.to_dict() for item in res.scalars().all()]

    csv_str = ExcelExporter.export_to_csv(results)
    filename = f"hr_contacts_export_{len(results)}_records.csv"

    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sample-template")
async def download_sample_excel_template():
    """
    Download the official sample Excel import template (.xlsx) with example company rows.
    """
    excel_bytes = ExcelImporter.generate_sample_excel()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="sample_companies_template.xlsx"'
        },
    )


@router.get("/sample-csv")
async def download_sample_csv_template():
    """
    Download the official sample CSV import template with example company rows.
    """
    csv_str = ExcelImporter.generate_sample_csv()
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="sample_companies_template.csv"'
        },
    )
