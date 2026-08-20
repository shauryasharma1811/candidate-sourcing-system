import uuid
from datetime import datetime

from pydantic import BaseModel

from app.common.enums import ApplicationStatus
from app.models.application import Application


class ApplicationListItem(BaseModel):
    """A row in the admin applications review grid. Flattens the candidate
    name and job title from their relations so the frontend doesn't have to
    join anything client-side."""

    id: uuid.UUID
    candidate_name: str
    candidate_email: str
    job_title: str
    job_id: uuid.UUID
    status: ApplicationStatus
    applied_at: datetime

    @classmethod
    def from_model(cls, application: Application) -> "ApplicationListItem":
        candidate = application.candidate
        job = application.job
        return cls(
            id=application.id,
            candidate_name=f"{candidate.first_name} {candidate.last_name}" if candidate else "",
            candidate_email=candidate.user.email if candidate and candidate.user else "",
            job_title=job.title if job else "",
            job_id=application.job_id,
            status=application.status,
            applied_at=application.applied_at,
        )
