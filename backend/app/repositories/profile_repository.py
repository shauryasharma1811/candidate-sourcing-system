import uuid

from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.models.candidate import Candidate
from app.repositories.base import BaseRepository


class CandidateRepository(BaseRepository[Candidate]):
    def __init__(self, db: Session):
        super().__init__(Candidate, db)

    def get_by_user_id(self, user_id: uuid.UUID) -> Candidate | None:
        return self.db.query(Candidate).filter(Candidate.user_id == user_id).first()


class AdminRepository(BaseRepository[Admin]):
    def __init__(self, db: Session):
        super().__init__(Admin, db)

    def get_by_user_id(self, user_id: uuid.UUID) -> Admin | None:
        return self.db.query(Admin).filter(Admin.user_id == user_id).first()
