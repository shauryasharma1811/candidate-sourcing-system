from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_role
from app.common.enums import JobStatus, UserRole
from app.db.session import get_db
from app.models.user import User
from app.schemas.requisition import RequisitionCreateRequest, RequisitionUpdateRequest
from app.schemas.response import SuccessResponse
from app.services.job_service import JobService

router = APIRouter(
    prefix="/admin/requisitions",
    tags=["requisitions (admin)"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("", response_model=SuccessResponse)
def list_requisitions(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    status: JobStatus | None = None,
    q: str | None = Query(None, description="Search by job title"),
):
    data, meta = JobService(db).list_admin(page=page, page_size=page_size, status=status, q=q)
    return SuccessResponse(message="Requisitions retrieved", data=data, meta=meta.model_dump())


@router.post("", response_model=SuccessResponse)
def create_requisition(
    payload: RequisitionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Created as Draft by default; payload.publish=True publishes immediately.
    data = JobService(db).create_requisition(current_user, payload)
    message = "Requisition published" if payload.publish else "Requisition saved as draft"
    return SuccessResponse(message=message, data=data)


@router.get("/{job_id}", response_model=SuccessResponse)
def get_requisition(job_id: str, db: Session = Depends(get_db)):
    data = JobService(db).get_admin_detail(job_id)
    return SuccessResponse(message="Requisition retrieved", data=data)


@router.put("/{job_id}", response_model=SuccessResponse)
def update_requisition(job_id: str, payload: RequisitionUpdateRequest, db: Session = Depends(get_db)):
    data = JobService(db).update_requisition(job_id, payload)
    message = "Requisition published" if payload.publish else "Requisition updated"
    return SuccessResponse(message=message, data=data)


@router.post("/{job_id}/publish", response_model=SuccessResponse)
def publish_requisition(job_id: str, db: Session = Depends(get_db)):
    data = JobService(db).publish_requisition(job_id)
    return SuccessResponse(message="Requisition published", data=data)


@router.post("/{job_id}/close", response_model=SuccessResponse)
def close_requisition(job_id: str, db: Session = Depends(get_db)):
    data = JobService(db).close_requisition(job_id)
    return SuccessResponse(message="Requisition closed", data=data)
