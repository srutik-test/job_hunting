"""
Application Configuration Settings.
All secrets and tunables are provided exclusively through environment
variables / a local .env file. Nothing secret is hard-coded here.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings (loaded from environment)."""

    # ------------------------------------------------------------------ App
    APP_NAME: str = "HR & Recruitment Contact Intelligence Platform"
    APP_VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # ------------------------------------------------------------------ Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ------------------------------------------------------------------ Security
    # REQUIRED in production. Used for JWT signing and (derived) API-key encryption.
    SECRET_KEY: str = "dev-insecure-secret-change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 h
    # Separate key for encrypting stored provider API keys (Fernet).
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: Optional[str] = None  # falls back to derived key from SECRET_KEY
    COOKIE_SECURE: bool = False  # set True behind HTTPS
    COOKIE_SAMESITE: str = "lax"

    # ------------------------------------------------------------------ Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/app.db"
    # Example: postgresql+asyncpg://postgres:postgres@db:5432/hr_platform

    # ------------------------------------------------------------------ Auth / Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    # Public backend URL used for the OAuth redirect (must be reachable by the browser)
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"

    # Email token lifetimes (minutes)
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 60 * 24
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    # ------------------------------------------------------------------ SMTP (verification & reset emails)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "no-reply@hr-platform.local"
    SMTP_STARTTLS: bool = True
    # In development, when SMTP is not configured, links are returned in API
    # responses and written to the log instead of being emailed.

    # ------------------------------------------------------------------ CAPTCHA
    # One of: none | dev-math | turnstile | recaptcha | hcaptcha
    CAPTCHA_PROVIDER: str = "dev-math"
    CAPTCHA_SECRET_KEY: Optional[str] = None
    CAPTCHA_SITE_KEY: Optional[str] = (
        None  # surfaced to the frontend via /auth/captcha/config
    )

    # ------------------------------------------------------------------ Crawler
    CRAWLER_MAX_CONCURRENCY: int = 5
    CRAWLER_TIMEOUT_SECONDS: int = 15
    CRAWLER_MAX_PAGES_PER_COMPANY: int = 30
    CRAWLER_USER_AGENT: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
        "(HR Contact Research; +https://github.com/hr-contact-platform)"
    )
    CRAWLER_MAX_RETRIES: int = 2
    CRAWLER_RESPECT_ROBOTS: bool = True
    # Browser fallback for JavaScript-heavy sites (requires `playwright install chromium`)
    ENABLE_PLAYWRIGHT: bool = False
    PLAYWRIGHT_MAX_PAGES: int = 8

    # ------------------------------------------------------------------ Search
    ENABLE_PUBLIC_SEARCH: bool = True
    SEARCH_RATE_LIMIT_DELAY: float = 1.0
    SEARCH_MAX_RESULTS: int = 8
    # Google Custom Search (optional, paid)
    GOOGLE_SEARCH_API_KEY: Optional[str] = None
    GOOGLE_SEARCH_ENGINE_ID: Optional[str] = None

    # Optional paid providers (can also be configured per-user in Settings UI;
    # the DB-resident key always takes precedence over these env fallbacks)
    FIRECRAWL_API_KEY: Optional[str] = None
    FIRECRAWL_BASE_URL: str = "https://api.firecrawl.dev"
    HUNTER_API_KEY: Optional[str] = None
    APOLLO_API_KEY: Optional[str] = None
    APOLLO_BASE_URL: str = "https://api.apollo.io"

    # SMTP handshake verification is disabled by default because many
    # deliverability providers block it; enable explicitly if acceptable.
    ENABLE_SMTP_VERIFICATION: bool = False
    SMTP_VERIFICATION_FROM: str = "verify@example.com"

    # ------------------------------------------------------------------ Rate limiting
    RATE_LIMIT_AUTH: str = "8/minute"  # register/login/captcha-prone endpoints
    RATE_LIMIT_SEARCH: str = "20/minute"  # starting searches
    RATE_LIMIT_DEFAULT: str = "240/minute"

    # ------------------------------------------------------------------ Storage
    DATA_DIR: str = "./data"
    EXPORTS_DIR: str = "./data/exports"
    UPLOADS_DIR: str = "./data/uploads"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )


settings = Settings()
