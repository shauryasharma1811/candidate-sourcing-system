"""
Public-careers business logic. Controllers (app/api/v1/routes/jobs.py) call
into this module only. No route or repository composes filters/pagination
on its own — that logic lives here, exactly once.
"""
import math
import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.enums import EmploymentType, JobStatus
from app.models.job import Job
from app.repositories.job_repository import JobRepository
from app.repositories.profile_repository import AdminRepository
from app.schemas.job import JobFiltersResponse, JobPublicDetail, JobPublicListItem, PaginatedMeta

MAX_PAGE_SIZE = 50


class JobService:
    def __init__(self, db: Session):
        self.db = db
        self.jobs = JobRepository(db)
        self.admins = AdminRepository(db)

    def list_public(
        self,
        page: int = 1,
        page_size: int = 20,
        q: str | None = None,
        department: str | None = None,
        location: str | None = None,
        experience: str | None = None,
    ) -> tuple[list[JobPublicListItem], PaginatedMeta]:
        page = max(page, 1)
        page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
        skip = (page - 1) * page_size

        items, total = self.jobs.list_published(
            skip=skip,
            limit=page_size,
            q=q,
            department=department,
            location=location,
            experience=experience,
        )

        data = [JobPublicListItem.model_validate(job) for job in items]
        meta = PaginatedMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=max(1, math.ceil(total / page_size)),
        )
        return data, meta

    def get_public_detail(self, job_id: str) -> JobPublicDetail:
        try:
            job_uuid = uuid.UUID(job_id)
        except ValueError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

        job = self.jobs.get_published_by_id(job_uuid)
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

        return JobPublicDetail.model_validate(job)

    def get_filters(self) -> JobFiltersResponse:
        return JobFiltersResponse(
            departments=self.jobs.distinct_departments(),
            locations=self.jobs.distinct_locations(),
            experience_levels=self.jobs.distinct_experience_levels(),
            employment_types=[e.value for e in EmploymentType],
        )

    # ------------------------------------------------------------------
    # Admin-scoped — sees Draft/Published/Closed, not just Published
    # ------------------------------------------------------------------
    def list_admin(self, page: int = 1, page_size: int = 20, status=None, q: str | None = None):
        from app.schemas.requisition import RequisitionListItem

        page = max(page, 1)
        page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
        skip = (page - 1) * page_size

        items, total = self.jobs.list_admin(skip=skip, limit=page_size, status=status, q=q)

        counts = self.jobs.application_counts_for([job.id for job in items])
        data = []
        for job in items:
            item = RequisitionListItem.model_validate(job)
            item.application_count = counts.get(job.id, 0)
            data.append(item)
        meta = PaginatedMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=max(1, math.ceil(total / page_size)),
        )
        return data, meta

    def _get_admin_job_or_404(self, job_id: str) -> Job:
        try:
            job_uuid = uuid.UUID(job_id)
        except ValueError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Requisition not found")

        job = self.jobs.get_by_id(job_uuid)
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Requisition not found")
        return job

    def _generate_requisition_code(self) -> str:
        """REQ-<year>-<sequential>, e.g. REQ-2026-0001. Sequence is derived
        from the current row count; the DB's unique constraint on
        requisition_code is the real guarantee against collisions, so on
        the rare race we just retry with the next number."""
        year = date.today().year
        seq = self.jobs.count_all() + 1
        while True:
            code = f"REQ-{year}-{seq:04d}"
            if not self.jobs.code_exists(code):
                return code
            seq += 1

    def get_admin_detail(self, job_id: str):
        from app.schemas.requisition import RequisitionDetail

        job = self._get_admin_job_or_404(job_id)
        detail = RequisitionDetail.model_validate(job)
        detail.application_count = self.jobs.application_count_for(job.id)
        return detail

    def create_requisition(self, current_user, payload):
        from app.schemas.requisition import RequisitionDetail

        admin = self.admins.get_by_user_id(current_user.id)
        if not admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin profile not found")

        job = Job(
            title=payload.title,
            requisition_code=self._generate_requisition_code(),
            department=payload.department,
            location=payload.location,
            employment_type=payload.employment_type,
            experience_required=payload.experience_required,
            openings=payload.openings,
            hiring_manager=payload.hiring_manager,
            description=payload.description,
            max_salary=payload.max_salary,
            hiring_completion_date=payload.hiring_completion_date,
            status=JobStatus.PUBLISHED if payload.publish else JobStatus.DRAFT,
            created_by_admin_id=admin.id,
        )
        job = self.jobs.create(job)
        return RequisitionDetail.model_validate(job)

    def update_requisition(self, job_id: str, payload):
        from app.schemas.requisition import RequisitionDetail

        job = self._get_admin_job_or_404(job_id)
        if job.status == JobStatus.CLOSED:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Closed requisitions cannot be edited")

        job.title = payload.title
        job.department = payload.department
        job.location = payload.location
        job.employment_type = payload.employment_type
        job.experience_required = payload.experience_required
        job.openings = payload.openings
        job.hiring_manager = payload.hiring_manager
        job.description = payload.description
        job.max_salary = payload.max_salary
        job.hiring_completion_date = payload.hiring_completion_date
        if payload.publish and job.status == JobStatus.DRAFT:
            job.status = JobStatus.PUBLISHED

        job = self.jobs.update(job)
        return RequisitionDetail.model_validate(job)

    def publish_requisition(self, job_id: str):
        from app.schemas.requisition import RequisitionDetail

        job = self._get_admin_job_or_404(job_id)
        if job.status != JobStatus.DRAFT:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only Draft requisitions can be published")

        job.status = JobStatus.PUBLISHED
        job = self.jobs.update(job)
        return RequisitionDetail.model_validate(job)

    def close_requisition(self, job_id: str):
        from app.schemas.requisition import RequisitionDetail

        job = self._get_admin_job_or_404(job_id)
        if job.status != JobStatus.PUBLISHED:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only Published requisitions can be closed")

        job.status = JobStatus.CLOSED
        job = self.jobs.update(job)
        return RequisitionDetail.model_validate(job)

    def duplicate_requisition(self, job_id: str, current_user):
        """Copies every editable field onto a brand-new Draft with its own
        auto-generated requisition_code — never the applications, status,
        or admin-review history, since those belong to the original."""
        from app.schemas.requisition import RequisitionDetail

        source = self._get_admin_job_or_404(job_id)
        admin = self.admins.get_by_user_id(current_user.id)
        if not admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin profile not found")

        copy = Job(
            title=f"{source.title} (Copy)"[:150],
            requisition_code=self._generate_requisition_code(),
            department=source.department,
            location=source.location,
            employment_type=source.employment_type,
            experience_required=source.experience_required,
            openings=source.openings,
            hiring_manager=source.hiring_manager,
            description=source.description,
            max_salary=source.max_salary,
            hiring_completion_date=source.hiring_completion_date,
            status=JobStatus.DRAFT,
            created_by_admin_id=admin.id,
        )
        copy = self.jobs.create(copy)
        return RequisitionDetail.model_validate(copy)

    def delete_requisition(self, job_id: str) -> None:
        """Delete is only safe for a requisition that never went live: once
        Published, applications may reference it, and Closed requisitions
        are the historical record — both are edited via status transitions
        (close), never removed."""
        job = self._get_admin_job_or_404(job_id)
        if job.status != JobStatus.DRAFT:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only Draft requisitions can be deleted")
        if self.jobs.application_count_for(job.id) > 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Requisitions with applications cannot be deleted")

        self.jobs.delete(job)
