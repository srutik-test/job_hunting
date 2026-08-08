"""
Health check and system diagnostics endpoint.
"""
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["Health & System"])


@router.get("")
async def health_check():
    """
    Return platform health status, capabilities, and active configuration.
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "features": {
            "recursive_crawler": True,
            "sitemap_xml_parser": True,
            "public_search_engine": settings.ENABLE_SEARCH_ENGINE,
            "dns_mx_verifier": True,
            "excel_xlsx_import_export": True,
            "csv_import_export": True,
            "structured_live_logging": True,
        }
    }
