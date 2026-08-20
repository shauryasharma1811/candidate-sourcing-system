import uuid

from sqlalchemy.orm import Session, joinedload

from app.common.enums import ApplicationStatus
from app.models.application import Application
from app.models.candidate import Candidate
from app.repositories.base import BaseRepository


class ApplicationRepository(BaseRepository[Application]):
    def __init__(self, db: Session):
        super().__init__(Application, db)

    def count_all(self) -> int:
        return self.db.query(Application).count()

    def count_by_status(self, status: ApplicationStatus) -> int:
        return self.db.query(Application).filter(Application.status == status).count()

    def list_admin(
        self,
        skip: int,
        limit: int,
        status: ApplicationStatus | None = None,
        job_id: uuid.UUID | None = None,
    ) -> tuple[list[Application], int]:
        query = self.db.query(Application).options(
            joinedload(Application.candidate).joinedload(Candidate.user),
            joinedload(Application.job),
        )
        if status:
            query = query.filter(Application.status == status)
        if job_id:
            query = query.filter(Application.job_id == job_id)
        query = query.order_by(Application.applied_at.desc())

        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return items, total

    def get_with_relations(self, application_id: uuid.UUID) -> Application | None:
        return (
            self.db.query(Application)
            .options(joinedload(Application.candidate), joinedload(Application.job), joinedload(Application.resume))
            .filter(Application.id == application_id)
            .first()
        )
