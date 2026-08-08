"""Company endpoints – list and delete saved companies."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_verified_user
from app.models import Company, User
from app.schemas.domain import CompanyResponse

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("", response_model=list[CompanyResponse])
async def list_companies(
    q: str = Query("", max_length=200),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (select(Company).where(Company.user_id == user.id)
            .order_by(Company.created_at.desc()).limit(limit))
    if q:
        stmt = stmt.where(Company.name.ilike(f"%{q}%"))
    res = await db.execute(stmt)
    return [CompanyResponse(**c.to_dict()) for c in res.scalars().all()]


@router.delete("/{company_id}", status_code=204)
async def delete_company(company_id: str,
                         user: User = Depends(get_verified_user),
                         db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Company).where(
        Company.id == company_id, Company.user_id == user.id))
    company = res.scalars().first()
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found.")
    await db.delete(company)
    await db.commit()
    return None
