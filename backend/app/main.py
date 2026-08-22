from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.rate_limit import limiter
from app.schemas.response import ErrorResponse
from app.services.storage_service import ensure_bucket_lifecycle_policy

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    # Hide interactive docs in production — they're not secrets, but they
    # do map out the entire API surface for free; keep that internal.
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    openapi_url="/openapi.json" if settings.APP_ENV != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (H-1) — protects /auth/login, /auth/admin/login,
# /auth/register, /auth/forgot-password, and resume upload from
# credential-stuffing / brute-force / spam abuse. Individual limits are
# applied per-route via the @limiter.limit(...) decorator; this wiring
# just registers the limiter with the app and the 429 handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.on_event("startup")
def apply_storage_retention_policy() -> None:
    # Storage-layer backstop for the resume retention policy (see
    # retention_service). Best-effort — never blocks startup.
    ensure_bucket_lifecycle_policy()


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(message=str(exc.detail), errors=[]).model_dump(),
    )


app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health_check():
    return {"success": True, "message": "ok", "data": {"status": "healthy"}}
