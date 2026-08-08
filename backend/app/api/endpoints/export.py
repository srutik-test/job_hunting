"""Excel export + sample template endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_verified_user
from app.models import Company, HRContact, Search, User
from app.services.excel import (
    build_results_workbook, sample_template_xlsx, new_export_filename,
)
from app.services.orchestrator import domain_of, normalize_website

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
        "website": company.website,
        "location": company.location or "",
        "name": contact.name,
        "designation": contact.designation,
        "email": contact.email,
        "linkedin_url": contact.linkedin_url,
        "source_label": _SOURCE_LABELS.get(contact.source_type, contact.source_type),
        "source_url": contact.source_url,
        "discovery_method": contact.discovery_method,
        "verification_status": contact.verification_status.replace("_", " "),
        "confidence_score": contact.confidence_score,
        "created_at": contact.created_at.strftime("%Y-%m-%d %H:%M")
        if contact.created_at else "",
    }


async def _export_response(db: AsyncSession, user: User,
                           search_id: Optional[str]) -> Response:
    stmt = (select(HRContact, Company)
            .join(Company, Company.id == HRContact.company_id)
            .where(HRContact.user_id == user.id)
            .order_by(Company.name.asc(),
                      HRContact.contact_category.asc(),
                      HRContact.confidence_score.desc()))
    if search_id:
        stmt = stmt.where(HRContact.search_id == search_id)
    res = await db.execute(stmt)
    rows = [_row_for(c, comp) for c, comp in res.all()]
    if not rows:
        raise HTTPException(status_code=404,
                            detail="No contacts available to export.")
    workbook = build_results_workbook(rows)
    filename = new_export_filename()
    return Response(
        content=workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/excel")
async def export_excel(search_id: Optional[str] = Query(None),
                       user: User = Depends(get_verified_user),
                       db: AsyncSession = Depends(get_db)):
    return await _export_response(db, user, search_id)


@router.get("/template")
async def sample_template(user: User = Depends(get_verified_user)):
    return Response(
        content=sample_template_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition":
                 'attachment; filename="companies_template.xlsx"'},
    )
