import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.enums import JobStatus
from app.models.job import Job
from app.repositories.base import BaseRepository


class JobRepository(BaseRepository[Job]):
    """All public-careers queries scope to Job.status == PUBLISHED — a
    candidate must never be able to see a Draft or Closed requisition."""

    def __init__(self, db: Session):
        super().__init__(Job, db)

    def _published_query(
        self,
        q: str | None = None,
        department: str | None = None,
        location: str | None = None,
        experience: str | None = None,
    ):
        query = self.db.query(Job).filter(Job.status == JobStatus.PUBLISHED)

        if q:
            query = query.filter(Job.title.ilike(f"%{q.strip()}%"))
        if department:
            query = query.filter(Job.department == department)
        if location:
            query = query.filter(Job.location == location)
        if experience:
            query = query.filter(Job.experience_required == experience)

        return query.order_by(Job.created_at.desc())

    def list_published(
        self,
        skip: int,
        limit: int,
        q: str | None = None,
        department: str | None = None,
        location: str | None = None,
        experience: str | None = None,
    ) -> tuple[list[Job], int]:
        query = self._published_query(q=q, department=department, location=location, experience=experience)
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return items, total

    def get_published_by_id(self, job_id: uuid.UUID) -> Job | None:
        return (
            self.db.query(Job)
            .filter(Job.id == job_id, Job.status == JobStatus.PUBLISHED)
            .first()
        )

    def distinct_departments(self) -> list[str]:
        rows = self.db.execute(
            select(Job.department).where(Job.status == JobStatus.PUBLISHED).distinct().order_by(Job.department)
        )
        return [r[0] for r in rows]

    def distinct_locations(self) -> list[str]:
        rows = self.db.execute(
            select(Job.location).where(Job.status == JobStatus.PUBLISHED).distinct().order_by(Job.location)
        )
        return [r[0] for r in rows]

    def distinct_experience_levels(self) -> list[str]:
        rows = self.db.execute(
            select(Job.experience_required)
            .where(Job.status == JobStatus.PUBLISHED, Job.experience_required.isnot(None))
            .distinct()
            .order_by(Job.experience_required)
        )
        return [r[0] for r in rows]

    # ------------------------------------------------------------------
    # Admin-scoped — sees every status, not just Published
    # ------------------------------------------------------------------
    def count_by_status(self, status: JobStatus) -> int:
        return self.db.query(Job).filter(Job.status == status).count()

    def list_admin(
        self,
        skip: int,
        limit: int,
        status: JobStatus | None = None,
        q: str | None = None,
    ) -> tuple[list[Job], int]:
        query = self.db.query(Job)
        if status:
            query = query.filter(Job.status == status)
        if q:
            query = query.filter(Job.title.ilike(f"%{q.strip()}%"))
        query = query.order_by(Job.created_at.desc())

        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return items, total

    def get_by_id(self, job_id: uuid.UUID) -> Job | None:
        """Admin-scoped lookup — any status, unlike get_published_by_id."""
        return self.db.query(Job).filter(Job.id == job_id).first()

    def code_exists(self, requisition_code: str) -> bool:
        return self.db.query(Job).filter(Job.requisition_code == requisition_code).first() is not None

    def count_all(self) -> int:
        return self.db.query(Job).count()
