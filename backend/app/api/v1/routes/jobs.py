from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.response import SuccessResponse
from app.services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs (public)"])


@router.get("", response_model=SuccessResponse)
def list_published_jobs(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    q: str | None = Query(None, description="Search by job title"),
    department: str | None = None,
    location: str | None = None,
    experience: str | None = None,
):
    data, meta = JobService(db).list_public(
        page=page,
        page_size=page_size,
        q=q,
        department=department,
        location=location,
        experience=experience,
    )
    return SuccessResponse(message="Jobs retrieved", data=data, meta=meta.model_dump())


@router.get("/filters", response_model=SuccessResponse)
def get_job_filters(db: Session = Depends(get_db)):
    # Must be declared before /{job_id} so "filters" isn't swallowed as an id.
    filters = JobService(db).get_filters()
    return SuccessResponse(message="Filters retrieved", data=filters)


@router.get("/{job_id}", response_model=SuccessResponse)
def get_job_detail(job_id: str, db: Session = Depends(get_db)):
    job = JobService(db).get_public_detail(job_id)
    return SuccessResponse(message="Job retrieved", data=job)
