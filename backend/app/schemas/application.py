import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.common.enums import ApplicationStatus
from app.models.application import Application
from app.models.candidate import Candidate
from app.schemas.candidate import (
    ApplicationProgressJob,
    BioDataResponse,
    EducationItem,
    ExperienceItem,
    ResumeMetadata,
)


def experience_summary(candidate: Candidate | None) -> str:
    """'Experience' grid column, per BRD. Freshers and candidates with no
    experience entries on file show as such; otherwise the total tenure
    across every entry (current roles count through today), to one
    decimal place — e.g. '3.5 yrs'."""
    if candidate is None:
        return "—"
    if candidate.is_fresher:
        return "Fresher"

    entries = candidate.experience_entries or []
    if not entries:
        return "—"

    total_days = 0
    today = date.today()
    for entry in entries:
        end = entry.end_date or today
        total_days += max((end - entry.start_date).days, 0)

    years = total_days / 365.25
    return f"{years:.1f} yrs"


class ApplicationListItem(BaseModel):
    """A row in the admin applications review grid — every BRD-required
    column (Candidate, Applied On, Experience, Location, Resume, Status)
    plus Application ID and Job for cross-requisition context, flattened
    from relations so the frontend doesn't have to join anything
    client-side."""

    id: uuid.UUID
    application_code: str
    candidate_name: str
    candidate_email: str
    candidate_location: str | None
    experience_summary: str
    job_title: str
    job_id: uuid.UUID
    status: ApplicationStatus
    applied_at: datetime
    resume: ResumeMetadata | None

    @classmethod
    def from_model(cls, application: Application) -> "ApplicationListItem":
        candidate = application.candidate
        job = application.job
        return cls(
            id=application.id,
            application_code=application.application_code,
            candidate_name=f"{candidate.first_name} {candidate.last_name}" if candidate else "",
            candidate_email=candidate.user.email if candidate and candidate.user else "",
            candidate_location=candidate.location if candidate else None,
            experience_summary=experience_summary(candidate),
            job_title=job.title if job else "",
            job_id=application.job_id,
            status=application.status,
            applied_at=application.applied_at,
            resume=ResumeMetadata.model_validate(application.resume) if application.resume else None,
        )


class ApplicationStatusUpdateRequest(BaseModel):
    status: ApplicationStatus


class ApplicationStatusUpdateResponse(BaseModel):
    id: uuid.UUID
    status: ApplicationStatus
    reviewed_at: datetime | None


class ResumeDownloadLink(BaseModel):
    url: str
    expires_in_seconds: int


class TimelineEvent(BaseModel):
    """One entry in the application's audit trail — submission, any
    notifications dispatched off it, and status changes, oldest first."""

    event: str
    label: str
    at: datetime
    actor: str | None = None


class ApplicationDetail(BaseModel):
    """Backs 'View full application' from the admin grid — the job, the
    candidate's full profile snapshot, and the application's own
    status/audit fields, in one call."""

    id: uuid.UUID
    application_code: str
    status: ApplicationStatus
    applied_at: datetime
    reviewed_at: datetime | None
    reviewed_by_admin_name: str | None
    cover_note: str | None

    job: ApplicationProgressJob
    bio: BioDataResponse
    education: list[EducationItem]
    experience: list[ExperienceItem]
    is_fresher: bool
    experience_summary: str
    resume: ResumeMetadata | None
    timeline: list[TimelineEvent] = []
