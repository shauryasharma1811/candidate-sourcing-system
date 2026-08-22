from fastapi import APIRouter, Depends, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_role
from app.common.enums import ApplicationStatus, UserRole
from app.core.rate_limit import RESUME_UPLOAD_RATE_LIMIT, limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.application import ApplicationStatusUpdateRequest
from app.schemas.candidate import ApplicationSubmitRequest
from app.schemas.response import SuccessResponse
from app.services.application_service import ApplicationService

router = APIRouter(tags=["applications"])

# --- Candidate-facing: multi-step application flow ---
candidate_router = APIRouter(
    prefix="/applications",
    tags=["applications (candidate)"],
    dependencies=[Depends(require_role(UserRole.CANDIDATE))],
)


@candidate_router.get("/{job_id}/progress", response_model=SuccessResponse)
def get_application_progress(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Backs the Review & Submit step — the job plus everything the
    candidate has saved so far across bio/education/experience/resume."""
    data = ApplicationService(db).get_progress(current_user, job_id)
    return SuccessResponse(message="Progress retrieved", data=data)


@candidate_router.post("/{job_id}/resume", response_model=SuccessResponse)
@limiter.limit(RESUME_UPLOAD_RATE_LIMIT)
def upload_resume(
    request: Request,
    job_id: str,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = ApplicationService(db).upload_resume(current_user, job_id, file)
    return SuccessResponse(message="Resume uploaded", data=data)


@candidate_router.delete("/{job_id}/resume", response_model=SuccessResponse)
def delete_resume(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ApplicationService(db).delete_resume(current_user, job_id)
    return SuccessResponse(message="Resume removed", data=None)


@candidate_router.post("/{job_id}/submit", response_model=SuccessResponse)
def submit_application(
    job_id: str,
    payload: ApplicationSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = ApplicationService(db).submit_application(current_user, job_id, payload)
    return SuccessResponse(message="Application submitted", data=data)


@candidate_router.get("/mine", response_model=SuccessResponse)
def list_my_applications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = ApplicationService(db).list_mine(current_user)
    return SuccessResponse(message="Applications retrieved", data=data)


# --- Admin-facing: review grid ---
admin_router = APIRouter(
    prefix="/admin/applications",
    tags=["applications (admin)"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@admin_router.get("", response_model=SuccessResponse)
def list_applications(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    status: ApplicationStatus | None = None,
    job_id: str | None = None,
    search: str | None = Query(None, description="Matches candidate first/last name or email"),
):
    data, meta = ApplicationService(db).list_admin(
        page=page, page_size=page_size, status_filter=status, job_id=job_id, search=search
    )
    return SuccessResponse(message="Applications retrieved", data=data, meta=meta.model_dump())


# NOTE: registered before "/{application_id}" — otherwise FastAPI would
# match "export" itself as an application_id path param.
@admin_router.get("/export")
def export_applications(
    db: Session = Depends(get_db),
    status: ApplicationStatus | None = None,
    job_id: str | None = None,
    search: str | None = None,
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
):
    """Export CSV/Excel, per BRD — same filters as the grid. Returns the
    file directly (not the {success,data} JSON envelope): a file download
    is a file response by nature, same as the resume itself.

    format=csv (default) preserves the original behaviour; format=xlsx
    fills the Excel-export gap flagged in the audit (M-1)."""
    service = ApplicationService(db)

    if format == "xlsx":
        xlsx_bytes = service.export_xlsx(status_filter=status, job_id=job_id, search=search)
        return StreamingResponse(
            iter([xlsx_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="applications.xlsx"'},
        )

    csv_text = service.export_csv(status_filter=status, job_id=job_id, search=search)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="applications.csv"'},
    )


@admin_router.get("/{application_id}", response_model=SuccessResponse)
def get_application(application_id: str, db: Session = Depends(get_db)):
    """View full application — the candidate's whole profile snapshot
    alongside the application's status/audit fields."""
    data = ApplicationService(db).get_admin_detail(application_id)
    return SuccessResponse(message="Application retrieved", data=data)


@admin_router.patch("/{application_id}/status", response_model=SuccessResponse)
def update_status(
    application_id: str,
    payload: ApplicationStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = ApplicationService(db).update_status(current_user, application_id, payload.status)
    return SuccessResponse(message="Status updated", data=data)


@admin_router.get("/{application_id}/resume", response_model=SuccessResponse)
def download_resume(application_id: str, db: Session = Depends(get_db)):
    # Returns a short-lived signed URL — storage path never exposed directly
    data = ApplicationService(db).get_resume_download_url(application_id)
    return SuccessResponse(message="Download link generated", data=data)
