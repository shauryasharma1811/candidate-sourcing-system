import uuid

from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.models.candidate import Candidate, Education, Experience
from app.repositories.base import BaseRepository


class CandidateRepository(BaseRepository[Candidate]):
    def __init__(self, db: Session):
        super().__init__(Candidate, db)

    def get_by_user_id(self, user_id: uuid.UUID) -> Candidate | None:
        return self.db.query(Candidate).filter(Candidate.user_id == user_id).first()


class EducationRepository(BaseRepository[Education]):
    def __init__(self, db: Session):
        super().__init__(Education, db)

    def list_for_candidate(self, candidate_id: uuid.UUID) -> list[Education]:
        return (
            self.db.query(Education)
            .filter(Education.candidate_id == candidate_id)
            .order_by(Education.passing_year.desc())
            .all()
        )

    def get_for_candidate(self, education_id: uuid.UUID, candidate_id: uuid.UUID) -> Education | None:
        return (
            self.db.query(Education)
            .filter(Education.id == education_id, Education.candidate_id == candidate_id)
            .first()
        )


class ExperienceRepository(BaseRepository[Experience]):
    def __init__(self, db: Session):
        super().__init__(Experience, db)

    def list_for_candidate(self, candidate_id: uuid.UUID) -> list[Experience]:
        return (
            self.db.query(Experience)
            .filter(Experience.candidate_id == candidate_id)
            .order_by(Experience.start_date.desc())
            .all()
        )

    def get_for_candidate(self, experience_id: uuid.UUID, candidate_id: uuid.UUID) -> Experience | None:
        return (
            self.db.query(Experience)
            .filter(Experience.id == experience_id, Experience.candidate_id == candidate_id)
            .first()
        )


class AdminRepository(BaseRepository[Admin]):
    def __init__(self, db: Session):
        super().__init__(Admin, db)

    def get_by_user_id(self, user_id: uuid.UUID) -> Admin | None:
        return self.db.query(Admin).filter(Admin.user_id == user_id).first()

    def list_all(self) -> list[Admin]:
        return self.db.query(Admin).all()
