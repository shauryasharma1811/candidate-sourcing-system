"""
Central rate-limiting configuration (H-1).

Uses slowapi (a Flask-limiter-style wrapper around `limits`) keyed by
client IP. Limits are deliberately generous enough not to bother a real
user but tight enough to blunt credential-stuffing / brute-force /
registration-spam / upload-abuse attempts against the handful of
unauthenticated, high-value endpoints called out in the audit:

  /auth/login, /auth/admin/login, /auth/register, /auth/forgot-password,
  and resume upload.

Limits are configurable via env vars so they can be tuned per environment
without a code change (e.g. relaxed for local dev/tests, tightened in prod).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(key_func=get_remote_address, default_limits=[])

# Individual limit strings, e.g. "5/minute". Exposed as settings so they can
# be overridden per environment (see app/core/config.py).
LOGIN_RATE_LIMIT = settings.RATE_LIMIT_LOGIN
REGISTER_RATE_LIMIT = settings.RATE_LIMIT_REGISTER
FORGOT_PASSWORD_RATE_LIMIT = settings.RATE_LIMIT_FORGOT_PASSWORD
RESUME_UPLOAD_RATE_LIMIT = settings.RATE_LIMIT_RESUME_UPLOAD
