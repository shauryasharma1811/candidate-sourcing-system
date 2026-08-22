import uuid
from datetime import datetime

from sqlalchemy.orm import Session, joinedload

from app.models.resume import Resume
from app.repositories.base import BaseRepository


class ResumeRepository(BaseRepository[Resume]):
    def __init__(self, db: Session):
        super().__init__(Resume, db)

    def get_latest_for_candidate(self, candidate_id: uuid.UUID) -> Resume | None:
        return (
            self.db.query(Resume)
            .filter(Resume.candidate_id == candidate_id)
            .order_by(Resume.uploaded_at.desc())
            .first()
        )

    def get_for_candidate(self, resume_id: uuid.UUID, candidate_id: uuid.UUID) -> Resume | None:
        return self.db.query(Resume).filter(Resume.id == resume_id, Resume.candidate_id == candidate_id).first()

    def list_expired(self, now: datetime) -> list[Resume]:
        """Every resume past its retention window and not yet purged —
        backs the retention purge job. Eager-loads `application` so the
        purge job can check "still in use" without a query per row."""
        return (
            self.db.query(Resume)
            .options(joinedload(Resume.application))
            .filter(Resume.retention_expires_at.isnot(None))
            .filter(Resume.retention_expires_at <= now)
            .filter(Resume.purged_at.is_(None))
            .all()
        )
