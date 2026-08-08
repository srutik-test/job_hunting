"""
Company endpoints: CSV/Excel uploads, column validation, and manual entry.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from app.core.database import get_db
from app.models.company import Company
from app.models.job import ExtractionJob
from app.schemas.company import CompanyBase, CompanyResponse, CompanyBatchUploadPreview
from app.schemas.extraction import ManualExtractionRequest
from app.services.excel.importer import ExcelImporter
from app.services.pipeline.queue_worker import queue_manager

router = APIRouter(prefix="/companies", tags=["Companies & Uploads"])


@router.post("/upload-preview", response_model=CompanyBatchUploadPreview)
async def preview_company_upload(file: UploadFile = File(...)):
    """
    Validate uploaded Excel (.xlsx) or CSV file, detect columns,
    and return an interactive preview with validation warnings.
    """
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.",
        )

    content = await file.read()
    try:
        companies, preview = ExcelImporter.parse_file(content, file.filename)
        return preview
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)
        )


@router.post("/upload-and-start")
async def upload_and_start_extraction(
    file: UploadFile = File(...),
    crawler_engine: str = Form("auto"),
    enable_public_search: bool = Form(True),
    max_pages_per_company: int = Form(20),
    concurrency: int = Form(3),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload Excel/CSV file and immediately launch asynchronous extraction job.
    """
    content = await file.read()
    try:
        companies, _ = ExcelImporter.parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not companies:
        raise HTTPException(
            status_code=400, detail="No valid companies found in uploaded file."
        )

    # Create job in database
    job_id = str(uuid.uuid4())
    new_job = ExtractionJob(
        id=job_id,
        status="pending",
        total_companies=len(companies),
        processed_companies=0,
    )
    db.add(new_job)
    await db.commit()

    # Dispatch to background queue worker
    await queue_manager.start_job(
        job_id=job_id,
        companies=companies,
        crawler_engine=crawler_engine,
        enable_public_search=enable_public_search,
        max_pages=max_pages_per_company,
        concurrency=concurrency,
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "total_companies": len(companies),
        "message": f"Successfully queued extraction for {len(companies)} companies.",
    }


@router.post("/manual-start")
async def manual_entry_start_extraction(
    request: ManualExtractionRequest, db: AsyncSession = Depends(get_db)
):
    """
    Start extraction for manually entered company records.
    """
    if not request.companies:
        raise HTTPException(
            status_code=400, detail="At least one company must be provided."
        )

    job_id = str(uuid.uuid4())
    new_job = ExtractionJob(
        id=job_id,
        status="pending",
        total_companies=len(request.companies),
        processed_companies=0,
    )
    db.add(new_job)
    await db.commit()

    await queue_manager.start_job(
        job_id=job_id,
        companies=request.companies,
        crawler_engine=request.crawler_engine,
        enable_public_search=request.enable_public_search,
        max_pages=request.max_pages_per_company,
        concurrency=3,
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "total_companies": len(request.companies),
        "message": f"Extraction job created for {len(request.companies)} companies.",
    }
