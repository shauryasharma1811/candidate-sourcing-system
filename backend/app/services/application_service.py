"""
Admin applications-grid business logic. Controllers call into this module
only. The candidate-facing submit/upload flow is Sprint 4 and lives
elsewhere once built; this service is read-only for the admin review grid.
"""
import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.enums import ApplicationStatus
from app.repositories.application_repository import ApplicationRepository
from app.schemas.application import ApplicationListItem
from app.schemas.common import PaginatedMeta

MAX_PAGE_SIZE = 50


class ApplicationService:
    def __init__(self, db: Session):
        self.db = db
        self.applications = ApplicationRepository(db)

    def list_admin(
        self,
        page: int = 1,
        page_size: int = 20,
        status_filter: ApplicationStatus | None = None,
        job_id: str | None = None,
    ) -> tuple[list[ApplicationListItem], PaginatedMeta]:
        page = max(page, 1)
        page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
        skip = (page - 1) * page_size

        job_uuid: uuid.UUID | None = None
        if job_id:
            try:
                job_uuid = uuid.UUID(job_id)
            except ValueError:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid job_id")

        items, total = self.applications.list_admin(skip=skip, limit=page_size, status=status_filter, job_id=job_uuid)

        data = [ApplicationListItem.from_model(app) for app in items]
        meta = PaginatedMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=max(1, math.ceil(total / page_size)),
        )
        return data, meta
