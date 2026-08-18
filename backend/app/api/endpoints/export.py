"""Excel export + sample template endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_verified_user
from app.models import Company, HRContact, Search, User
from app.services.excel import (
    build_results_workbook,
    sample_template_xlsx,
    new_export_filename,
)

router = APIRouter(prefix="/export", tags=["Export"])

_SOURCE_LABELS = {
    "company_website": "Official Company Website",
    "search_provider": "Public Search Index",
    "email_finder": "Email Discovery Provider",
    "people_provider": "Professional Data Provider",
    "linkedin_page": "LinkedIn (public index)",
}


def _row_for(contact: HRContact, company: Company) -> dict:
    return {
        "company_name": company.name,
        "email": contact.email,
        "phone": contact.phone or "",
        "website": company.website,
        "linkedin_url": contact.linkedin_url or company.linkedin_url or "",
        "location": company.location or "",
        "name": contact.name,
        "designation": contact.designation,
        "source_label": _SOURCE_LABELS.get(contact.source_type, contact.source_type),
        "source_url": contact.source_url,
        "discovery_method": contact.discovery_method,
        "verification_status": contact.verification_status.replace("_", " "),
        "confidence_score": contact.confidence_score,
        "created_at": (
            contact.created_at.strftime("%Y-%m-%d %H:%M") if contact.created_at else ""
        ),
    }


async def _export_response(
    db: AsyncSession,
    user: User,
    search_id: Optional[str] = None,
    category: Optional[str] = None,
    verification_status: Optional[str] = None,
    company_name: Optional[str] = None,
    min_confidence: Optional[int] = None,
    q: Optional[str] = None,
    contact_ids: Optional[str] = None,
) -> Response:
    stmt = (
        select(HRContact, Company)
        .join(Company, Company.id == HRContact.company_id)
        .where(HRContact.user_id == user.id)
        .order_by(
            Company.name.asc(),
            HRContact.contact_category.asc(),
            HRContact.confidence_score.desc(),
        )
    )
    if search_id:
        stmt = stmt.where(HRContact.search_id == search_id)
    if contact_ids:
        ids = [cid.strip() for cid in contact_ids.split(",") if cid.strip()]
        if ids:
            stmt = stmt.where(HRContact.id.in_(ids))
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
    rows = [_row_for(c, comp) for c, comp in res.all()]
    if not rows:
        raise HTTPException(status_code=404, detail="No contacts available to export.")
    workbook = build_results_workbook(rows)
    filename = new_export_filename()
    return Response(
        content=workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/excel")
async def export_excel(
    search_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    company_name: Optional[str] = Query(None),
    min_confidence: Optional[int] = Query(None, ge=0, le=100),
    q: Optional[str] = Query(None),
    contact_ids: Optional[str] = Query(None),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    return await _export_response(
        db,
        user,
        search_id=search_id,
        category=category,
        verification_status=verification_status,
        company_name=company_name,
        min_confidence=min_confidence,
        q=q,
        contact_ids=contact_ids,
    )


@router.get("/template")
async def sample_template(user: User = Depends(get_verified_user)):
    return Response(
        content=sample_template_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="companies_template.xlsx"'
        },
    )
