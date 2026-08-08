"""
Main API Router aggregating all sub-routers under /api/v1.
"""
from fastapi import APIRouter
from app.api.endpoints import companies, jobs, results, export, health

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(companies.router)
api_router.include_router(jobs.router)
api_router.include_router(results.router)
api_router.include_router(export.router)
