"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.logging import logger

logging.getLogger("platform").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema (SQLite fallback path)...")
    await init_db()
    logger.info("Platform ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Evidence-first HR & recruitment contact discovery. "
        "Never generates, guesses, or fabricates email addresses."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api_docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT,
                reload=settings.DEBUG)
