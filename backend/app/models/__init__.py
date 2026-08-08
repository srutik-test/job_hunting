"""Model registry – imported for metadata / Alembic discovery."""

from app.models.user import User
from app.models.token import AuthToken
from app.models.company import Company
from app.models.search import Search, SearchLog
from app.models.hr_contact import HRContact
from app.models.api_provider import APIProvider

__all__ = [
    "User",
    "AuthToken",
    "Company",
    "Search",
    "SearchLog",
    "HRContact",
    "APIProvider",
]
