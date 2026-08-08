"""
Background search worker.

Searches run as in-process asyncio background tasks so the API request
returning the search IDs never blocks on long crawls. State is persisted in
the database (`searches` / `search_logs`), which also makes it recoverable
and inspectable. Multi-instance deployments can move `handle_search` to a
dedicated worker service (see docker-compose `worker` profile).
"""

import asyncio
import logging
from typing import Dict

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import Search

logger = logging.getLogger("platform.worker")


class SearchWorker:
    """Singleton: tracks running tasks so they can be cancelled."""

    _tasks: Dict[str, asyncio.Task] = {}

    @classmethod
    def start(cls, search_id: str) -> None:
        task = asyncio.create_task(cls.handle_search(search_id))
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

        async with AsyncSessionLocal() as db:
            res = await db.execute(select(Search).where(Search.id == search_id))
            search = res.scalars().first()
            if search is None:
                logger.error("Worker: search %s not found", search_id)
                return
            res = await db.execute(
                select(Company).where(Company.id == search.company_id))
            company = res.scalars().first()
            if company is None:
                logger.error("Worker: company %s not found", search.company_id)
                return

            orchestrator = SearchOrchestrator(db, search, company)
            try:
                await orchestrator.run()
            except asyncio.CancelledError:
                logger.info("Search %s cancelled", search_id)
                from sqlalchemy import select as _s
                try:
                    db.add  # noqa
                    res = await db.execute(_s(Search).where(Search.id == search_id))
                    s = res.scalars().first()
                    if s and s.status == "processing":
                        s.status = "cancelled"
                        await db.commit()
                except Exception:
                    await db.rollback()
                raise
