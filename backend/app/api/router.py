"""Main API router aggregating all sub-routers."""

from fastapi import APIRouter

from app.api.endpoints import (
    auth, companies, contacts, dashboard, export, health, providers, searches,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(searches.router)
api_router.include_router(companies.router)
api_router.include_router(contacts.router)
api_router.include_router(providers.router)
api_router.include_router(export.router)
