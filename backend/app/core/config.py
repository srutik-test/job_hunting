"""
Application Configuration Settings.
Loads configuration from environment variables with sensible defaults.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application configuration settings."""
    
    # Application Info
    APP_NAME: str = "HR & Recruitment Contact Intelligence Platform"
    APP_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Server Binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
        "*"
    ]
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/hr_contacts.db"
    
    # Crawler Settings
    CRAWLER_MAX_CONCURRENCY: int = 5
    CRAWLER_TIMEOUT_SECONDS: int = 15
    CRAWLER_MAX_PAGES_PER_COMPANY: int = 25
    CRAWLER_USER_AGENT: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 (Public HR Contact Research Tool)"
    )
    CRAWLER_MAX_RETRIES: int = 3
    CRAWLER_RETRY_BACKOFF_FACTOR: float = 1.5
    CRAWLER_RESPECT_ROBOTS: bool = False
    
    # Public Search Configuration
    ENABLE_SEARCH_ENGINE: bool = True
    SEARCH_RATE_LIMIT_DELAY: float = 1.0  # seconds between search queries
    SEARCH_MAX_RESULTS: int = 8
    
    # Optional Third-Party API Keys (Graceful Fallback if omitted)
    FIRECRAWL_API_KEY: Optional[str] = None
    APOLLO_API_KEY: Optional[str] = None
    HUNTER_API_KEY: Optional[str] = None
    GOOGLE_SEARCH_API_KEY: Optional[str] = None
    GOOGLE_SEARCH_ENGINE_ID: Optional[str] = None
    
    # Celery / Redis (Optional fallback to in-memory async worker)
    REDIS_URL: Optional[str] = None
    USE_CELERY: bool = False
    
    # Storage Paths
    DATA_DIR: str = "./data"
    EXPORTS_DIR: str = "./data/exports"
    UPLOADS_DIR: str = "./data/uploads"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
