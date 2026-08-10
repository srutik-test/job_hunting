"""Dashboard statistics (scoped to the current user only)."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Company, HRContact, Search, User
from app.schemas.domain import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardStats)
async def dashboard_stats(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    async def count(stmt) -> int:
        res = await db.execute(stmt)
        return int(res.scalar_one() or 0)

    stats = DashboardStats()
    stats.total_companies = await count(
        select(func.count()).select_from(Company).where(Company.user_id == user.id)
    )
    stats.total_searches = await count(
        select(func.count()).select_from(Search).where(Search.user_id == user.id)
    )

    for status, field in (
        ("pending", "searches_pending"),
        ("processing", "searches_processing"),
        ("completed", "searches_completed"),
        ("failed", "searches_failed"),
        ("no_results", "searches_no_results"),
    ):
        value = await count(
            select(func.count())
            .select_from(Search)
            .where(Search.user_id == user.id, Search.status == status)
        )
        setattr(stats, field, value)

    stats.total_contacts = await count(
        select(func.count()).select_from(HRContact).where(HRContact.user_id == user.id)
    )
    stats.verified_contacts = await count(
        select(func.count())
        .select_from(HRContact)
        .where(
            HRContact.user_id == user.id, HRContact.contact_category == "verified_hr"
        )
    )
    stats.possible_contacts = await count(
        select(func.count())
        .select_from(HRContact)
        .where(
            HRContact.user_id == user.id, HRContact.contact_category == "possible_hr"
        )
    )
    stats.company_emails = await count(
        select(func.count())
        .select_from(HRContact)
        .where(
            HRContact.user_id == user.id, HRContact.contact_category == "company_email"
        )
    )
    stats.linkedin_profiles = await count(
        select(func.count())
        .select_from(HRContact)
        .where(HRContact.user_id == user.id, HRContact.contact_category == "linkedin")
    )
    return stats
