"""
Centralized application settings.
All environment-driven values are declared here — no os.getenv() calls
should appear anywhere else in the codebase.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_ENV: str = "development"
    APP_NAME: str = "Candidate Sourcing System"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # CORS — comma-separated list of allowed origins. In production this
    # must be the real frontend origin(s) only; never "*" alongside
    # allow_credentials=True (browsers reject that combination anyway).
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Database
    DATABASE_URL: str

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # S3 / Uploads
    S3_ENDPOINT_URL: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET_NAME: str
    S3_REGION: str = "us-east-1"
    MAX_UPLOAD_SIZE_MB: int = 5
    ALLOWED_UPLOAD_EXTENSIONS: str = ".pdf,.doc,.docx"
    RESUME_DOWNLOAD_URL_TTL_SECONDS: int = 300

    # Virus scanning — placeholder today (see app/services/virus_scan_service.py).
    # Kept as settings so a real scanner (ClamAV daemon URL, vendor API key,
    # etc.) is a config change, not a code change, when Sprint 6 wires one in.
    VIRUS_SCAN_ENABLED: bool = True
    VIRUS_SCAN_PROVIDER: str = "placeholder"

    # Retention policy — how long a resume is kept after upload before it's
    # eligible for purge. Applies at two layers: the S3 bucket's own
    # lifecycle rule (defense in depth, configured at startup) and the
    # app-level purge job in app/services/retention_service.py.
    RESUME_RETENTION_DAYS: int = 365

    # Email
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    SMTP_FROM_EMAIL: str

    # Frontend base URL — used to build absolute links (password-reset, etc.)
    # that get embedded in outgoing emails. Configurable per environment
    # (localhost in dev, the real deployed domain in staging/prod).
    FRONTEND_URL: str = "http://localhost:3000"
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # Rate limiting (H-1) — "N/unit" strings understood by slowapi/limits,
    # e.g. "5/minute". Kept as settings so they can be tuned per environment
    # (e.g. relaxed in tests) without a code change.
    RATE_LIMIT_LOGIN: str = "10/minute"
    RATE_LIMIT_REGISTER: str = "5/minute"
    RATE_LIMIT_FORGOT_PASSWORD: str = "5/minute"
    RATE_LIMIT_RESUME_UPLOAD: str = "10/minute"

    @property
    def allowed_upload_extensions_list(self) -> list[str]:
        return [ext.strip().lower() for ext in self.ALLOWED_UPLOAD_EXTENSIONS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
