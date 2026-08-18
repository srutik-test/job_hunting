"""Search endpoints – start, monitor, list, cancel, restart."""

from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    UploadFile,
    File,
    status,
)
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_verified_user
from app.core.rate_limit import rate_limit
from app.models import Company, HRContact, Search, SearchLog, User
from app.schemas.domain import (
    BatchRunResponse,
    ContactResponse,
    SearchLogResponse,
    SearchResponse,
    StartSearchRequest,
)
from app.services.excel import parse_companies_from_file
from app.services.orchestrator import normalize_website, domain_of
from app.services.worker import SearchWorker

router = APIRouter(prefix="/searches", tags=["Searches"])

_search_limit = rate_limit(settings.RATE_LIMIT_SEARCH, scope="search-start")


def _search_response(search: Search, company: Optional[Company]) -> SearchResponse:
    data = search.to_dict()
    data["company"] = company.to_dict() if company else None
    return SearchResponse(**data)


async def _find_or_create_company(db: AsyncSession, user_id: str, data) -> Company:
    norm_url = normalize_website(data.website) or str(data.website).strip().rstrip("/")
    dom = domain_of(norm_url)
    clean_name = " ".join(str(data.name).strip().lower().split())

    # Look for existing company by user_id and matching domain/name
    res = await db.execute(
        select(Company).where(
            Company.user_id == user_id,
            func.lower(Company.name) == clean_name,
        )
    )
    matching_companies = res.scalars().all()
    company = None
    for c in matching_companies:
        c_dom = domain_of(c.website)
        if c_dom == dom:
            company = c
            break

    if company is None:
        company = Company(
            user_id=user_id,
            name=str(data.name).strip()[:255],
            website=norm_url,
            location=(data.location or "")[:255],
            linkedin_url=(data.linkedin_url or "")[:1024],
            industry=(data.industry or "")[:255],
        )
        db.add(company)
        await db.flush()
    else:
        # Update metadata if new values are provided
        if getattr(data, "location", None) and not company.location:
            company.location = str(data.location)[:255]
        if getattr(data, "linkedin_url", None) and not company.linkedin_url:
            company.linkedin_url = str(data.linkedin_url)[:1024]
        if getattr(data, "industry", None) and not company.industry:
            company.industry = str(data.industry)[:255]
        await db.flush()
    return company


async def _create_and_start(db: AsyncSession, user: User, companies) -> list[Search]:
    # 1. Deduplicate within the incoming batch list (keep first occurrence)
    deduped_inputs = []
    seen_batch_keys = set()
    for item in companies:
        norm = normalize_website(item.website)
        if not norm:
            raise HTTPException(
                status_code=422, detail=f"Invalid website URL for {item.name!r}."
            )
        key = (" ".join(str(item.name).strip().lower().split()), domain_of(norm))
        if key in seen_batch_keys:
            continue
        seen_batch_keys.add(key)
        deduped_inputs.append(item)

    searches_to_return: list[Search] = []
    searches_to_start: list[str] = []

    for item in deduped_inputs:
        company = await _find_or_create_company(db, user.id, item)

        # Check existing searches for this company and user
        res = await db.execute(
            select(Search)
            .where(Search.user_id == user.id, Search.company_id == company.id)
            .order_by(Search.created_at.desc())
        )
        existing_searches = res.scalars().all()

        if existing_searches:
            latest_search = existing_searches[0]
            # If completed: skip duplicate entry without re-crawling
            if latest_search.status == "completed":
                searches_to_return.append(latest_search)
                continue

            # If in any other stage except completed: restart in the SAME card
            latest_search.status = "pending"
            latest_search.progress_pct = 0
            latest_search.current_step = "Queued for processing"
            latest_search.pages_crawled = 0
            latest_search.emails_found = 0
            latest_search.profiles_found = 0
            latest_search.duration_seconds = 0.0
            latest_search.error_message = None
            latest_search.summary = None
            latest_search.discovery_method = None
            latest_search.started_at = None
            latest_search.finished_at = None
            latest_search.created_at = datetime.now(timezone.utc)

            # Clear old logs and contacts for this search
            await db.execute(
                delete(SearchLog).where(SearchLog.search_id == latest_search.id)
            )
            await db.execute(
                delete(HRContact).where(HRContact.search_id == latest_search.id)
            )

            # If there are any older search rows for this company, remove duplicates
            for old_s in existing_searches[1:]:
                await db.delete(old_s)

            searches_to_return.append(latest_search)
            searches_to_start.append(latest_search.id)
        else:
            # Create fresh search
            search = Search(
                user_id=user.id,
                company_id=company.id,
                status="pending",
                current_step="Queued for processing",
            )
            db.add(search)
            searches_to_return.append(search)
            await db.flush()
            searches_to_start.append(search.id)

    await db.commit()
    for s in searches_to_return:
        await db.refresh(s)
    for sid in searches_to_start:
        SearchWorker.start(sid)

    return searches_to_return


@router.post(
    "",
    response_model=list[SearchResponse],
    status_code=201,
    dependencies=[Depends(_search_limit)],
)
async def start_search(
    payload: StartSearchRequest,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    searches = await _create_and_start(db, user, payload.companies)
    ids = [s.company_id for s in searches]
    res = await db.execute(select(Company).where(Company.id.in_(ids)))
    comp_map = {c.id: c for c in res.scalars().all()}
    return [_search_response(s, comp_map.get(s.company_id)) for s in searches]


@router.post(
    "/upload",
    response_model=list[SearchResponse],
    status_code=201,
    dependencies=[Depends(_search_limit)],
)
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
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Search, Company)
        .join(Company, Company.id == Search.company_id)
        .where(Search.user_id == user.id)
        .order_by(Search.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Search.status == status_filter)
    result = await db.execute(stmt)
    all_rows = result.all()

    # Deduplicate in response so each company only appears once (the latest search)
    seen_companies = set()
    deduped = []
    for s, c in all_rows:
        if c.id in seen_companies:
            continue
        seen_companies.add(c.id)
        deduped.append(_search_response(s, c))

    return deduped[offset : offset + limit]


async def _get_owned_search(db: AsyncSession, user: User, search_id: str) -> Search:
    res = await db.execute(
        select(Search).where(Search.id == search_id, Search.user_id == user.id)
    )
    search = res.scalars().first()
    if search is None:
        raise HTTPException(status_code=404, detail="Search not found.")
    return search


@router.get("/{search_id}", response_model=SearchResponse)
async def get_search(
    search_id: str,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
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
        select(SearchLog)
        .where(SearchLog.search_id == search.id)
        .order_by(SearchLog.created_at.asc(), SearchLog.id.asc())
    )
    return [SearchLogResponse(**log.to_dict()) for log in res.scalars().all()]


@router.get("/{search_id}/contacts", response_model=list[ContactResponse])
async def get_search_contacts(
    search_id: str,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    search = await _get_owned_search(db, user, search_id)
    res = await db.execute(
        select(HRContact)
        .where(HRContact.search_id == search.id)
        .order_by(HRContact.confidence_score.desc(), HRContact.contact_category.asc())
    )
    return [ContactResponse(**c.to_dict()) for c in res.scalars().all()]


@router.post("/{search_id}/restart", response_model=SearchResponse)
async def restart_search(
    search_id: str,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Restart a search from scratch on the same card."""
    search = await _get_owned_search(db, user, search_id)

    # Cancel any running task
    SearchWorker.cancel(search.id)

    # Reset search state
    search.status = "pending"
    search.progress_pct = 0
    search.current_step = "Queued for processing"
    search.pages_crawled = 0
    search.emails_found = 0
    search.profiles_found = 0
    search.duration_seconds = 0.0
    search.error_message = None
    search.summary = None
    search.discovery_method = None
    search.started_at = None
    search.finished_at = None
    search.created_at = datetime.now(timezone.utc)

    # Clear old logs and contacts
    await db.execute(delete(SearchLog).where(SearchLog.search_id == search.id))
    await db.execute(delete(HRContact).where(HRContact.search_id == search.id))
    await db.commit()
    await db.refresh(search)

    # Start worker
    SearchWorker.start(search.id)

    res = await db.execute(select(Company).where(Company.id == search.company_id))
    return _search_response(search, res.scalars().first())


@router.post("/{search_id}/cancel", response_model=SearchResponse)
async def cancel_search(
    search_id: str,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    search = await _get_owned_search(db, user, search_id)
    if search.status in ("pending", "processing"):
        search.status = "cancelled"
        search.finished_at = datetime.now(timezone.utc)
        await db.commit()
        SearchWorker.cancel(search.id)
    res = await db.execute(select(Company).where(Company.id == search.company_id))
    return _search_response(search, res.scalars().first())


@router.delete("/{search_id}", status_code=204)
async def delete_search(
    search_id: str,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    search = await _get_owned_search(db, user, search_id)
    await db.delete(search)
    await db.commit()
    return None
