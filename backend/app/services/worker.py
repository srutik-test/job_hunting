"""
Background search worker.

Searches run as in-process asyncio background tasks with concurrency control
so the API request returning the search IDs never blocks on long crawls.
State is persisted in the database (`searches` / `search_logs`).
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import Search

logger = logging.getLogger("platform.worker")


class SearchWorker:
    """Singleton: tracks running tasks with concurrency control and cancellation."""

    _tasks: Dict[str, asyncio.Task] = {}
    _semaphore: Optional[asyncio.Semaphore] = None
    _MAX_CONCURRENCY = 5

    @classmethod
    def _get_semaphore(cls) -> asyncio.Semaphore:
        if cls._semaphore is None:
            cls._semaphore = asyncio.Semaphore(cls._MAX_CONCURRENCY)
        return cls._semaphore

    @classmethod
    def start(cls, search_id: str) -> None:
        if search_id in cls._tasks and not cls._tasks[search_id].done():
            return  # Already running or queued

        task = asyncio.create_task(cls._run_with_semaphore(search_id))
        cls._tasks[search_id] = task

        def _done(t: asyncio.Task) -> None:
            cls._tasks.pop(search_id, None)
            if t.cancelled():
                return
            exc = t.exception()
            if exc:
                logger.error("Search %s task crashed: %s", search_id, exc)

        task.add_done_callback(_done)

    @classmethod
    async def _run_with_semaphore(cls, search_id: str) -> None:
        sem = cls._get_semaphore()
        async with sem:
            await cls.handle_search(search_id)

    @classmethod
    def cancel(cls, search_id: str) -> bool:
        task = cls._tasks.get(search_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    @classmethod
    async def handle_search(cls, search_id: str) -> None:
        from app.models import Company  # local import to avoid cycles
        from app.services.orchestrator import SearchOrchestrator

        try:
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(Search).where(Search.id == search_id))
                search = res.scalars().first()
                if search is None:
                    logger.error("Worker: search %s not found", search_id)
                    return
                
                # If already completed/failed/cancelled, skip
                if search.status in ("completed", "cancelled"):
                    return

                res = await db.execute(
                    select(Company).where(Company.id == search.company_id)
                )
                company = res.scalars().first()
                if company is None:
                    logger.error("Worker: company %s not found", search.company_id)
                    search.status = "failed"
                    search.error_message = "Associated company record not found."
                    search.finished_at = datetime.now(timezone.utc)
                    await db.commit()
                    return

                orchestrator = SearchOrchestrator(db, search, company)
                try:
                    await orchestrator.run()
                except asyncio.CancelledError:
                    logger.info("Search %s cancelled", search_id)
                    try:
                        res = await db.execute(
                            select(Search).where(Search.id == search_id)
                        )
                        s = res.scalars().first()
                        if s and s.status in ("processing", "pending"):
                            s.status = "cancelled"
                            s.finished_at = datetime.now(timezone.utc)
                            await db.commit()
                    except Exception:
                        await db.rollback()
                    raise
                except Exception as exc:
                    logger.exception("Search %s failed with error: %s", search_id, exc)
                    try:
                        res = await db.execute(
                            select(Search).where(Search.id == search_id)
                        )
                        s = res.scalars().first()
                        if s:
                            s.status = "failed"
                            s.error_message = f"Search failed: {exc}"
                            s.summary = f"Search failed: {exc}"
                            s.finished_at = datetime.now(timezone.utc)
                            await db.commit()
                    except Exception:
                        await db.rollback()
        except Exception as outer_exc:
            logger.error("Fatal worker error for search %s: %s", search_id, outer_exc)

    @classmethod
    async def recover_pending_searches(cls) -> None:
        """Find any pending or orphaned processing searches from prior runs and start them."""
        try:
            async with AsyncSessionLocal() as db:
                res = await db.execute(
                    select(Search).where(Search.status.in_(["pending", "processing"]))
                )
                stuck = res.scalars().all()
                if stuck:
                    logger.info(
                        "Worker recovering %d pending/orphaned searches...", len(stuck)
                    )
                    for s in stuck:
                        s.status = "pending"
                        cls.start(s.id)
                    await db.commit()
        except Exception as exc:
            logger.warning("Could not run recover_pending_searches: %s", exc)
