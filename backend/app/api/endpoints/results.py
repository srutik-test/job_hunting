"""
Results endpoints: Querying, filtering, sorting, and single company inspection.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, asc

from app.core.database import get_db
from app.models.result import ExtractionResult
from app.schemas.result import ResultResponse, ResultListResponse

router = APIRouter(prefix="/results", tags=["Results & Contact Intelligence"])


@router.get("", response_model=ResultListResponse)
async def get_results_list(
    search: Optional[str] = Query(
        None,
        description="Search across company name, website, HR name, email, location",
    ),
    status: Optional[str] = Query(
        None, description="Filter by status (e.g. Verified Public HR Email)"
    ),
    min_confidence: Optional[int] = Query(None, ge=0, le=100),
    has_hr_email: Optional[bool] = Query(None),
    job_id: Optional[str] = Query(None),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="asc or desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated, searchable, and filterable results table endpoint.
    """
    stmt = select(ExtractionResult)

    if job_id:
        stmt = stmt.where(ExtractionResult.job_id == job_id)

    if status and status != "all":
        stmt = stmt.where(ExtractionResult.status == status)

    if min_confidence is not None:
        stmt = stmt.where(ExtractionResult.confidence_score >= min_confidence)

    if has_hr_email is True:
        stmt = stmt.where(ExtractionResult.hr_email != "Not Publicly Available")

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            (ExtractionResult.company_name.ilike(term))
            | (ExtractionResult.website.ilike(term))
            | (ExtractionResult.location.ilike(term))
            | (ExtractionResult.hr_email.ilike(term))
            | (ExtractionResult.recruitment_email.ilike(term))
            | (ExtractionResult.hr_name.ilike(term))
            | (ExtractionResult.hr_position.ilike(term))
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0

    # Sorting
    sort_col = getattr(ExtractionResult, sort_by, ExtractionResult.created_at)
    if sort_order.lower() == "asc":
        stmt = stmt.order_by(asc(sort_col))
    else:
        stmt = stmt.order_by(desc(sort_col))

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    res = await db.execute(stmt)
    items = res.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return ResultListResponse(
        items=[item.to_dict() for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{result_id}", response_model=ResultResponse)
async def get_single_result(result_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get detailed breakdown of a single company extraction result.
    """
    stmt = select(ExtractionResult).where(ExtractionResult.id == result_id)
    res = await db.execute(stmt)
    result = res.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    return result.to_dict()


@router.delete("/{result_id}")
async def delete_result(result_id: str, db: AsyncSession = Depends(get_db)):
    """
    Delete a single result.
    """
    stmt = select(ExtractionResult).where(ExtractionResult.id == result_id)
    res = await db.execute(stmt)
    result = res.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    await db.delete(result)
    await db.commit()
    return {"deleted": True, "id": result_id}
