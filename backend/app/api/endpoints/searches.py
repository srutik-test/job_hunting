"""Search endpoints – start, monitor, list, cancel."""

from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from fastapi import (
    APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_verified_user
from app.core.rate_limit import rate_limit
from app.models import Company, HRContact, Search, SearchLog, User
from app.schemas.domain import (
    BatchRunResponse, ContactResponse, SearchLogResponse, SearchResponse,
    StartSearchRequest,
)
from app.services.excel import parse_companies_from_file
from app.services.orchestrator import normalize_website
from app.services.worker import SearchWorker

router = APIRouter(prefix="/searches", tags=["Searches"])

_search_limit = rate_limit(settings.RATE_LIMIT_SEARCH, scope="search-start")


def _search_response(search: Search, company: Optional[Company]) -> SearchResponse:
    data = search.to_dict()
    data["company"] = company.to_dict() if company else None
    return SearchResponse(**data)


async def _upsert_company(db: AsyncSession, user_id: str, data) -> Company:
    website = normalize_website(data.website) or data.website.strip()
    res = await db.execute(
        select(Company).where(Company.user_id == user_id,
                              Company.website == website,
                              func.lower(Company.name) == data.name.strip().lower())
    )
    company = res.scalars().first()
    if company is None:
        company = Company(
            user_id=user_id, name=data.name.strip()[:255], website=website,
            location=(data.location or "")[:255],
            linkedin_url=(data.linkedin_url or "")[:1024],
            industry=(data.industry or "")[:255],
        )
        db.add(company)
        await db.flush()
    return company


async def _create_and_start(db: AsyncSession, user: User, companies) -> list[Search]:
    created: list[Search] = []
    for item in companies:
        if not normalize_website(item.website):
            raise HTTPException(status_code=422,
                                detail=f"Invalid website URL for {item.name!r}.")
        company = await _upsert_company(db, user.id, item)
        search = Search(user_id=user.id, company_id=company.id, status="pending")
        db.add(search)
        created.append(search)
    await db.commit()
    for s in created:
        await db.refresh(s)
    for s in created:
        SearchWorker.start(s.id)
    return created


@router.post("", response_model=list[SearchResponse], status_code=201,
             dependencies=[Depends(_search_limit)])
async def start_search(payload: StartSearchRequest,
                       user: User = Depends(get_verified_user),
                       db: AsyncSession = Depends(get_db)):
    searches = await _create_and_start(db, user, payload.companies)
    ids = [s.company_id for s in searches]
    res = await db.execute(select(Company).where(Company.id.in_(ids)))
    comp_map = {c.id: c for c in res.scalars().all()}
    return [_search_response(s, comp_map.get(s.company_id)) for s in searches]


@router.post("/upload", response_model=list[SearchResponse], status_code=201,
             dependencies=[Depends(_search_limit)])
async def start_search_from_upload(
    file: UploadFile = File(...),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 5MB).")
    try:
        companies = parse_companies_from_file(content, file.filename or "")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    searches = await _create_and_start(db, user, companies)
    ids = [s.company_id for s in searches]
    res = await db.execute(select(Company).where(Company.id.in_(ids)))
    comp_map = {c.id: c for c in res.scalars().all()}
    return [_search_response(s, comp_map.get(s.company_id)) for s in searches]


@router.get("", response_model=list[SearchResponse])
async def list_searches(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Search, Company)
        .join(Company, Company.id == Search.company_id)
        .where(Search.user_id == user.id)
        .order_by(Search.created_at.desc())
        .limit(limit).offset(offset)
    )
    if status_filter:
        stmt = stmt.where(Search.status == status_filter)
    result = await db.execute(stmt)
    return [_search_response(s, c) for s, c in result.all()]


async def _get_owned_search(db: AsyncSession, user: User, search_id: str) -> Search:
    res = await db.execute(
        select(Search).where(Search.id == search_id, Search.user_id == user.id))
    search = res.scalars().first()
    if search is None:
        raise HTTPException(status_code=404, detail="Search not found.")
    return search


@router.get("/{search_id}", response_model=SearchResponse)
async def get_search(search_id: str, user: User = Depends(get_verified_user),
                     db: AsyncSession = Depends(get_db)):
    search = await _get_owned_search(db, user, search_id)
    res = await db.execute(select(Company).where(Company.id == search.company_id))
    return _search_response(search, res.scalars().first())


@router.get("/{search_id}/logs", response_model=list[SearchLogResponse])
async def get_search_logs(
    search_id: str,
    after_id: Optional[str] = Query(None),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    search = await _get_owned_search(db, user, search_id)
    res = await db.execute(
        select(SearchLog).where(SearchLog.search_id == search.id)
        .order_by(SearchLog.created_at.asc(), SearchLog.id.asc())
    )
    return [SearchLogResponse(**log.to_dict()) for log in res.scalars().all()]


@router.get("/{search_id}/contacts", response_model=list[ContactResponse])
async def get_search_contacts(search_id: str,
                              user: User = Depends(get_verified_user),
                              db: AsyncSession = Depends(get_db)):
    search = await _get_owned_search(db, user, search_id)
    res = await db.execute(
        select(HRContact).where(HRContact.search_id == search.id)
        .order_by(HRContact.confidence_score.desc(),
                  HRContact.contact_category.asc())
    )
    return [ContactResponse(**c.to_dict()) for c in res.scalars().all()]


@router.post("/{search_id}/cancel", response_model=SearchResponse)
async def cancel_search(search_id: str, user: User = Depends(get_verified_user),
                        db: AsyncSession = Depends(get_db)):
    search = await _get_owned_search(db, user, search_id)
    if search.status in ("pending", "processing"):
        search.status = "cancelled"
        search.finished_at = datetime.now()
        await db.commit()
        SearchWorker.cancel(search.id)
    res = await db.execute(select(Company).where(Company.id == search.company_id))
    return _search_response(search, res.scalars().first())


@router.delete("/{search_id}", status_code=204)
async def delete_search(search_id: str, user: User = Depends(get_verified_user),
                        db: AsyncSession = Depends(get_db)):
    search = await _get_owned_search(db, user, search_id)
    await db.delete(search)
    await db.commit()
    return None
