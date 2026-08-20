"""
Admin dashboard business logic. Controllers call into this module only.
"""
from sqlalchemy.orm import Session

from app.common.enums import ApplicationStatus, JobStatus
from app.repositories.application_repository import ApplicationRepository
from app.repositories.job_repository import JobRepository
from app.schemas.dashboard import DashboardStatsResponse


class DashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.jobs = JobRepository(db)
        self.applications = ApplicationRepository(db)

    def get_stats(self) -> DashboardStatsResponse:
        return DashboardStatsResponse(
            published_jobs=self.jobs.count_by_status(JobStatus.PUBLISHED),
            draft_jobs=self.jobs.count_by_status(JobStatus.DRAFT),
            closed_jobs=self.jobs.count_by_status(JobStatus.CLOSED),
            total_applications=self.applications.count_all(),
            new_applications=self.applications.count_by_status(ApplicationStatus.NEW),
        )
