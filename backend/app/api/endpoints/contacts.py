"""HR contact listing endpoints (all belong to the current user)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_verified_user
from app.models import Company, HRContact, User
from app.schemas.domain import ContactResponse

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=list[dict])
async def list_contacts(
    category: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    q: str = Query("", max_length=200),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(HRContact, Company)
        .join(Company, Company.id == HRContact.company_id)
        .where(HRContact.user_id == user.id)
        .order_by(HRContact.created_at.desc())
        .limit(limit).offset(offset)
    )
    if category:
        stmt = stmt.where(HRContact.contact_category == category)
    if verification_status:
        stmt = stmt.where(HRContact.verification_status == verification_status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (HRContact.email.ilike(like)) | (HRContact.name.ilike(like))
            | (Company.name.ilike(like))
        )
    res = await db.execute(stmt)
    out = []
    for contact, company in res.all():
        data = contact.to_dict()
        data["company_name"] = company.name
        data["company_website"] = company.website
        data["company_location"] = company.location or ""
        out.append(data)
    return out
