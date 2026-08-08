"""Health & capability diagnostics."""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health():
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "database": "postgresql" if "postgresql" in settings.DATABASE_URL else "sqlite",
        "captcha": settings.CAPTCHA_PROVIDER,
        "playwright": settings.ENABLE_PLAYWRIGHT,
        "smtp": bool(settings.SMTP_HOST),
        "google_oauth": bool(settings.GOOGLE_CLIENT_ID),
    }
