"""HR contact listing and management endpoints (all belong to the current user)."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_verified_user
from app.models import Company, HRContact, User

router = APIRouter(prefix="/contacts", tags=["Contacts"])


class BulkDeleteRequest(BaseModel):
    contact_ids: List[str] = Field(..., min_length=1, max_length=1000)


@router.get("", response_model=list[dict])
async def list_contacts(
    category: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    company_name: Optional[str] = Query(None),
    min_confidence: Optional[int] = Query(None, ge=0, le=100),
    q: str = Query("", max_length=200),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(HRContact, Company)
        .join(Company, Company.id == HRContact.company_id)
        .where(HRContact.user_id == user.id)
        .order_by(HRContact.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if category:
        stmt = stmt.where(HRContact.contact_category == category)
    if verification_status:
        stmt = stmt.where(HRContact.verification_status == verification_status)
    if company_name:
        stmt = stmt.where(Company.name.ilike(f"%{company_name}%"))
    if min_confidence is not None:
        stmt = stmt.where(HRContact.confidence_score >= min_confidence)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (HRContact.email.ilike(like))
            | (HRContact.name.ilike(like))
            | (HRContact.designation.ilike(like))
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


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single contact belonging to the authenticated user."""
    res = await db.execute(
        select(HRContact).where(
            HRContact.id == contact_id, HRContact.user_id == user.id
        )
    )
    contact = res.scalars().first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")
    await db.delete(contact)
    await db.commit()
    return {"ok": True, "message": "Contact deleted successfully."}


@router.post("/bulk-delete")
async def bulk_delete_contacts(
    body: BulkDeleteRequest,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple contacts in a single batch operation."""
    stmt = delete(HRContact).where(
        HRContact.id.in_(body.contact_ids), HRContact.user_id == user.id
    )
    result = await db.execute(stmt)
    await db.commit()
    deleted_count = result.rowcount or 0
    return {
        "ok": True,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} contact(s).",
    }
