"""
Retention policy for stored resumes. This module owns the *decision*
(what's expired, per settings.RESUME_RETENTION_DAYS) and the *purge
action* (deleting the DB row and the object); it never touches boto3
directly — deleting the physical object goes through
`storage_service.delete_resume`, same as every other caller, per the
storage module's "only module that touches boto3" contract.

Two layers implement the same policy:
  1. App-level: `purge_expired_resumes()` here, meant to be invoked by a
     scheduled job (cron / Sprint 6's background worker). Can also be
     triggered manually via the admin maintenance endpoint in the
     meantime.
  2. Storage-level: an S3 bucket lifecycle rule (configured once at
     startup by `storage_service.ensure_bucket_lifecycle_policy`) as a
     backstop that expires objects even if the app-level job never runs.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)


def compute_retention_expiry(from_time: datetime | None = None) -> datetime:
    """Retention window for a resume uploaded at `from_time` (default:
    now). Centralized here so upload and any future re-computation (e.g.
    an admin manually extending retention) agree on the same policy."""
    base = from_time or datetime.now(timezone.utc)
    return base + timedelta(days=settings.RESUME_RETENTION_DAYS)


def purge_expired_resumes(db, *, dry_run: bool = False) -> dict:
    """Delete every resume past its retention window: removes the S3
    object (via storage_service), then the DB row. A resume still
    attached to an application in an active (non-terminal) state is
    skipped and reported separately — retention shouldn't silently break
    a candidate's in-flight application.

    Returns a summary dict rather than raising, so a scheduled job can
    log/alert on it without the purge run itself failing on one bad row.
    """
    from app.models.resume import Resume
    from app.repositories.resume_repository import ResumeRepository
    from app.services import storage_service

    repo = ResumeRepository(db)
    expired = repo.list_expired(now=datetime.now(timezone.utc))

    purged: list[str] = []
    skipped: list[str] = []
    failed: list[str] = []

    for resume in expired:
        # A resume still linked to an application is left alone — it's
        # part of that application's record, not just orphaned storage.
        if resume.application is not None:
            skipped.append(str(resume.id))
            continue

        if dry_run:
            purged.append(str(resume.id))
            continue

        try:
            storage_service.delete_resume(resume.generated_filename)
            resume.purged_at = datetime.now(timezone.utc)
            repo.delete(resume)
            purged.append(str(resume.id))
        except Exception:
            logger.exception("Failed to purge expired resume %s", resume.id)
            failed.append(str(resume.id))

    return {"purged": purged, "skipped_in_use": skipped, "failed": failed, "dry_run": dry_run}
