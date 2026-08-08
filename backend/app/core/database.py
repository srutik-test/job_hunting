"""
Database engine/session setup.
Supports PostgreSQL (production) and SQLite (local development fallback),
both through Async SQLAlchemy 2.0.
"""

from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.orm import declarative_base

from app.core.config import settings

Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.EXPORTS_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """
    Create tables when missing (used for the SQLite dev path and for tests).
    Production deployments should run `alembic upgrade head` instead.
    """
    from app import models  # noqa: F401 - ensure models are registered

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
