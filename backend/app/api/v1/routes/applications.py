from fastapi import APIRouter, Depends, Query, UploadFile
from sqlalchemy.orm import Session

from app.auth.deps import require_role
from app.common.enums import ApplicationStatus, UserRole
from app.db.session import get_db
from app.schemas.response import SuccessResponse
from app.services.application_service import ApplicationService

router = APIRouter(tags=["applications"])

# --- Candidate-facing: multi-step application flow ---
candidate_router = APIRouter(
    prefix="/applications",
    tags=["applications (candidate)"],
    dependencies=[Depends(require_role(UserRole.CANDIDATE))],
)


@candidate_router.post("/{job_id}/resume", response_model=SuccessResponse)
def upload_resume(job_id: str, file: UploadFile, db: Session = Depends(get_db)):
    # -> application_service.upload_resume — validates size/type, stores via S3, returns metadata only
    ...


@candidate_router.post("/{job_id}/submit", response_model=SuccessResponse)
def submit_application(job_id: str, db: Session = Depends(get_db)):
    # -> application_service.submit — bio + education + experience + resume + consent required
    ...


@candidate_router.get("/mine", response_model=SuccessResponse)
def list_my_applications(db: Session = Depends(get_db)):
    ...


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
):
    data, meta = ApplicationService(db).list_admin(page=page, page_size=page_size, status_filter=status, job_id=job_id)
    return SuccessResponse(message="Applications retrieved", data=data, meta=meta.model_dump())


@admin_router.get("/{application_id}", response_model=SuccessResponse)
def get_application(application_id: str, db: Session = Depends(get_db)):
    ...


@admin_router.patch("/{application_id}/status", response_model=SuccessResponse)
def update_status(application_id: str, db: Session = Depends(get_db)):
    ...


@admin_router.get("/{application_id}/resume", response_model=SuccessResponse)
def download_resume(application_id: str, db: Session = Depends(get_db)):
    # Returns a short-lived signed URL — storage path never exposed directly
    ...


@admin_router.get("/export", response_model=SuccessResponse)
def export_applications(db: Session = Depends(get_db), format: str = "csv"):
    ...
