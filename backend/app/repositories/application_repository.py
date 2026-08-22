import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.common.enums import ApplicationStatus
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.user import User
from app.repositories.base import BaseRepository

MAX_EXPORT_ROWS = 5000


class ApplicationRepository(BaseRepository[Application]):
    def __init__(self, db: Session):
        super().__init__(Application, db)

    def count_all(self) -> int:
        return self.db.query(Application).count()

    def code_exists(self, application_code: str) -> bool:
        return self.db.query(Application).filter(Application.application_code == application_code).first() is not None

    def count_by_status(self, status: ApplicationStatus) -> int:
        return self.db.query(Application).filter(Application.status == status).count()

    def _admin_query(
        self,
        status: ApplicationStatus | None = None,
        job_id: uuid.UUID | None = None,
        search: str | None = None,
    ):
        """Shared filter logic behind both the paginated grid and the CSV
        export, so the two can never drift out of sync with each other."""
        query = (
            self.db.query(Application)
            .join(Candidate, Application.candidate_id == Candidate.id)
            .join(User, Candidate.user_id == User.id)
            .options(
                joinedload(Application.candidate).joinedload(Candidate.user),
                joinedload(Application.candidate).joinedload(Candidate.experience_entries),
                joinedload(Application.job),
                joinedload(Application.resume),
            )
        )
        if status:
            query = query.filter(Application.status == status)
        if job_id:
            query = query.filter(Application.job_id == job_id)
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Candidate.first_name.ilike(term),
                    Candidate.last_name.ilike(term),
                    User.email.ilike(term),
                )
            )
        return query

    def list_admin(
        self,
        skip: int,
        limit: int,
        status: ApplicationStatus | None = None,
        job_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> tuple[list[Application], int]:
        query = self._admin_query(status=status, job_id=job_id, search=search).order_by(Application.applied_at.desc())
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return items, total

    def list_for_export(
        self,
        status: ApplicationStatus | None = None,
        job_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> list[Application]:
        """Same filters as the grid, unpaginated (capped) — backs Export CSV."""
        return (
            self._admin_query(status=status, job_id=job_id, search=search)
            .order_by(Application.applied_at.desc())
            .limit(MAX_EXPORT_ROWS)
            .all()
        )

    def get_with_relations(self, application_id: uuid.UUID) -> Application | None:
        return (
            self.db.query(Application)
            .options(
                joinedload(Application.candidate).joinedload(Candidate.user),
                joinedload(Application.candidate).joinedload(Candidate.education_entries),
                joinedload(Application.candidate).joinedload(Candidate.experience_entries),
                joinedload(Application.job),
                joinedload(Application.resume),
                joinedload(Application.reviewed_by_admin),
                joinedload(Application.notifications),
            )
            .filter(Application.id == application_id)
            .first()
        )

    # ------------------------------------------------------------------
    # Candidate-facing — the guided application flow
    # ------------------------------------------------------------------
    def get_by_candidate_and_job(self, candidate_id: uuid.UUID, job_id: uuid.UUID) -> Application | None:
        return (
            self.db.query(Application)
            .filter(Application.candidate_id == candidate_id, Application.job_id == job_id)
            .first()
        )

    def list_for_candidate(self, candidate_id: uuid.UUID) -> list[Application]:
        return (
            self.db.query(Application)
            .options(joinedload(Application.job))
            .filter(Application.candidate_id == candidate_id)
            .order_by(Application.applied_at.desc())
            .all()
        )
