"""
Admin-only storage maintenance. Today this is the manual entry point for
the retention purge job (retention_service.purge_expired_resumes) — until
Sprint 6's background-worker/scheduler exists, an admin (or an external
cron hitting this authenticated endpoint) triggers it directly.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import require_role
from app.common.enums import UserRole
from app.db.session import get_db
from app.schemas.response import SuccessResponse
from app.services import retention_service

router = APIRouter(
    prefix="/admin/storage",
    tags=["storage (admin)"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.post("/purge-expired", response_model=SuccessResponse)
def purge_expired_resumes(
    db: Session = Depends(get_db),
    dry_run: bool = Query(False, description="Report what would be purged without deleting anything"),
):
    """Deletes every resume past its retention window (see
    RESUME_RETENTION_DAYS) that isn't still attached to an application.
    Safe to call repeatedly — already-purged rows are never re-selected."""
    summary = retention_service.purge_expired_resumes(db, dry_run=dry_run)
    return SuccessResponse(message="Retention purge complete", data=summary)
