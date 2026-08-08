"""
Job endpoints: Live progress, logs, cancellation, and metrics.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.core.database import get_db
from app.models.job import ExtractionJob
from app.models.result import ExtractionResult
from app.schemas.job import JobProgressResponse, JobStatsResponse
from app.core.logging import get_job_logs
from app.services.pipeline.queue_worker import queue_manager

router = APIRouter(prefix="/jobs", tags=["Jobs & Processing Queue"])


@router.get("/progress/{job_id}", response_model=JobProgressResponse)
async def get_job_progress(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get live progress metrics for a running or completed extraction job.
    """
    stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job.to_dict()


@router.get("/logs/{job_id}")
async def get_job_log_stream(
    job_id: str,
    limit: int = Query(200, ge=1, le=1000),
    since: Optional[str] = None
):
    """
    Fetch structured live logs for a specific extraction job.
    """
    logs = get_job_logs(job_id=job_id, limit=limit, since_timestamp=since)
    return {"job_id": job_id, "logs": logs, "count": len(logs)}


@router.post("/cancel/{job_id}")
async def cancel_job(job_id: str):
    """
    Cancel an ongoing extraction job.
    """
    success = await queue_manager.cancel_job(job_id)
    return {"job_id": job_id, "cancelled": success, "message": "Job cancellation requested"}


@router.get("/stats", response_model=JobStatsResponse)
async def get_global_extraction_stats(db: AsyncSession = Depends(get_db)):
    """
    Get global aggregated discovery and confidence statistics.
    """
    # Total jobs
    jobs_count_res = await db.execute(select(func.count(ExtractionJob.id)))
    total_jobs = jobs_count_res.scalar() or 0

    # Total results
    results_count_res = await db.execute(select(func.count(ExtractionResult.id)))
    total_results = results_count_res.scalar() or 0

    # Verified HR emails
    hr_count_res = await db.execute(
        select(func.count(ExtractionResult.id)).where(ExtractionResult.hr_email != "Not Publicly Available")
    )
    total_hr_emails = hr_count_res.scalar() or 0

    # Recruitment emails
    recruit_count_res = await db.execute(
        select(func.count(ExtractionResult.id)).where(ExtractionResult.recruitment_email != "Not Publicly Available")
    )
    total_recruit_emails = recruit_count_res.scalar() or 0

    # General emails
    general_count_res = await db.execute(
        select(func.count(ExtractionResult.id)).where(ExtractionResult.general_email != "Not Publicly Available")
    )
    total_general_emails = general_count_res.scalar() or 0

    # LinkedIn profiles
    li_count_res = await db.execute(
        select(func.count(ExtractionResult.id)).where(ExtractionResult.linkedin_profile_url != "Not Publicly Available")
    )
    total_li_profiles = li_count_res.scalar() or 0

    # Average confidence
    avg_conf_res = await db.execute(select(func.avg(ExtractionResult.confidence_score)))
    avg_conf = float(avg_conf_res.scalar() or 0.0)

    # Active job
    active_job_res = await db.execute(
        select(ExtractionJob.id).where(ExtractionJob.status == "running").order_by(ExtractionJob.created_at.desc())
    )
    active_job = active_job_res.scalars().first()

    discovery_rate = round((total_hr_emails / total_results) * 100, 1) if total_results > 0 else 0.0

    return JobStatsResponse(
        total_jobs=total_jobs,
        total_companies_processed=total_results,
        total_verified_hr_emails=total_hr_emails,
        total_recruitment_emails=total_recruit_emails,
        total_general_emails=total_general_emails,
        total_linkedin_profiles=total_li_profiles,
        overall_hr_discovery_rate=discovery_rate,
        average_confidence_score=round(avg_conf, 1),
        active_job_id=active_job
    )
