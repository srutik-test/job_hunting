"""
Background Queue Worker.
Manages asynchronous processing jobs, concurrency throttling,
real-time status updates, and SSE/WebSocket event streaming.
"""

import asyncio
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.job import ExtractionJob
from app.models.result import ExtractionResult
from app.models.company import Company
from app.schemas.company import CompanyBase
from app.services.pipeline.coordinator import ExtractionCoordinator
from app.core.logging import add_job_log


class JobQueueManager:
    """Singleton Job Queue Manager."""

    _instance: Optional["JobQueueManager"] = None
    _active_tasks: Dict[str, asyncio.Task] = {}
    _paused_jobs: set[str] = set()

    @classmethod
    def get_instance(cls) -> "JobQueueManager":
        if cls._instance is None:
            cls._instance = JobQueueManager()
        return cls._instance

    async def start_job(
        self,
        job_id: str,
        companies: List[CompanyBase],
        crawler_engine: str = "auto",
        enable_public_search: bool = True,
        max_pages: int = 20,
        concurrency: int = 3,
    ) -> str:
        """Spawn background async job processing."""
        task = asyncio.create_task(
            self._execute_job(
                job_id=job_id,
                companies=companies,
                crawler_engine=crawler_engine,
                enable_public_search=enable_public_search,
                max_pages=max_pages,
                concurrency=concurrency,
            )
        )
        self._active_tasks[job_id] = task
        return job_id

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel an ongoing job."""
        if job_id in self._active_tasks:
            self._active_tasks[job_id].cancel()
            del self._active_tasks[job_id]

        async with AsyncSessionLocal() as session:
            stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
            result = await session.execute(stmt)
            job = result.scalar_one_or_none()
            if job:
                job.status = "cancelled"
                job.completed_at = datetime.now(timezone.utc)
                await session.commit()
        return True

    async def _execute_job(
        self,
        job_id: str,
        companies: List[CompanyBase],
        crawler_engine: str,
        enable_public_search: bool,
        max_pages: int,
        concurrency: int,
    ) -> None:
        """Background worker loop executing the batch extraction."""
        coordinator = ExtractionCoordinator(
            crawler_engine=crawler_engine, enable_public_search=enable_public_search
        )
        semaphore = asyncio.Semaphore(concurrency)
        total = len(companies)
        processed_count = 0
        start_ts = time.time()

        add_job_log(
            job_id,
            "INFO",
            f"🚀 Starting extraction job for {total} companies (concurrency={concurrency})",
        )

        # Update job to running in DB
        async with AsyncSessionLocal() as session:
            stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
            res = await session.execute(stmt)
            job = res.scalar_one_or_none()
            if job:
                job.status = "running"
                job.started_at = datetime.now(timezone.utc)
                job.total_companies = total
                await session.commit()

        async def _process_single(comp: CompanyBase, index: int):
            nonlocal processed_count
            async with semaphore:
                # Update current state
                async with AsyncSessionLocal() as session:
                    stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
                    res = await session.execute(stmt)
                    j = res.scalar_one_or_none()
                    if j:
                        j.current_company_name = comp.name
                        j.current_page = comp.website
                        await session.commit()

                # Progress callback for the crawler
                def _page_progress_cb(data: Dict[str, Any]):
                    pass  # Can be expanded for live sub-page updates

                try:
                    result_data = await coordinator.process_company(
                        company_name=comp.name,
                        website=comp.website,
                        location=comp.location or "",
                        linkedin_url=comp.linkedin_url or "",
                        max_pages=max_pages,
                        job_id=job_id,
                        progress_callback=_page_progress_cb,
                    )

                    # Persist Result to DB
                    async with AsyncSessionLocal() as session:
                        # Find or create company
                        c_stmt = select(Company).where(Company.website == comp.website)
                        c_res = await session.execute(c_stmt)
                        db_comp = c_res.scalar_one_or_none()
                        if not db_comp:
                            db_comp = Company(
                                name=comp.name,
                                location=comp.location or "",
                                website=comp.website,
                                linkedin_url=comp.linkedin_url or "",
                            )
                            session.add(db_comp)
                            await session.flush()

                        ext_result = ExtractionResult(
                            job_id=job_id,
                            company_id=db_comp.id,
                            company_name=result_data["company_name"],
                            location=result_data["location"],
                            website=result_data["website"],
                            linkedin_url=result_data["linkedin_url"],
                            hr_email=result_data["hr_email"],
                            recruitment_email=result_data["recruitment_email"],
                            careers_email=result_data["careers_email"],
                            general_email=result_data["general_email"],
                            hr_name=result_data["hr_name"],
                            hr_position=result_data["hr_position"],
                            linkedin_profile_url=result_data["linkedin_profile"],
                            confidence_score=result_data["confidence_score"],
                            source=result_data["source"],
                            status=result_data["status"],
                            crawled_pages_count=result_data["crawled_pages_count"],
                            raw_details_json=result_data["raw_details_json"],
                        )
                        session.add(ext_result)

                        # Update job progress
                        processed_count += 1
                        j_stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
                        j_res = await session.execute(j_stmt)
                        j = j_res.scalar_one_or_none()
                        if j:
                            j.processed_companies = processed_count
                            j.pages_crawled_count += result_data["crawled_pages_count"]
                            if (
                                result_data["hr_email"] != "Not Publicly Available"
                                or result_data["recruitment_email"]
                                != "Not Publicly Available"
                            ):
                                j.emails_found_count += 1
                            if (
                                result_data["linkedin_profile"]
                                != "Not Publicly Available"
                            ):
                                j.profiles_found_count += 1

                            # Estimate remaining seconds
                            elapsed = time.time() - start_ts
                            avg_time = (
                                elapsed / processed_count if processed_count > 0 else 0
                            )
                            remaining = max(0.0, avg_time * (total - processed_count))
                            j.estimated_remaining_seconds = round(remaining, 1)

                        await session.commit()

                except Exception as e:
                    add_job_log(
                        job_id, "ERROR", f"Error processing '{comp.name}': {str(e)}"
                    )
                    processed_count += 1

        # Run tasks with concurrency
        tasks = [_process_single(comp, idx) for idx, comp in enumerate(companies)]
        await asyncio.gather(*tasks, return_exceptions=True)

        # Mark job completed
        async with AsyncSessionLocal() as session:
            stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
            res = await session.execute(stmt)
            job = res.scalar_one_or_none()
            if job:
                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc)
                job.estimated_remaining_seconds = 0.0
                await session.commit()

        add_job_log(
            job_id,
            "INFO",
            f"🎉 Extraction job {job_id} successfully completed for all {total} companies!",
        )
        if job_id in self._active_tasks:
            del self._active_tasks[job_id]


queue_manager = JobQueueManager.get_instance()
