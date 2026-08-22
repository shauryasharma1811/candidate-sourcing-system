"""
Schemas for the candidate-facing guided application flow:
Bio Data -> Education -> Experience -> Resume Upload -> Review & Submit.

Education/Experience live on the Candidate's persistent profile (reused
across every application, per the data model) — each wizard step saves
directly to the backend as the candidate moves through it, which is what
gives us "save between steps" and safe back-navigation for free.
"""
import re
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.common.enums import ApplicationStatus, Gender, JobStatus, NoticePeriod, ScanStatus

MOBILE_RE = re.compile(r"^\+?[0-9]{7,15}$")
MIN_CANDIDATE_AGE_YEARS = 18


# ----------------------------------------------------------------------
# Step 1 — Bio Data
# ----------------------------------------------------------------------
class ProfilePhotoMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    original_name: str
    mime_type: str
    size_bytes: int


class BioDataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    gender: Gender | None
    email: str
    mobile: str
    dob: date | None
    location: str | None
    current_company: str | None
    notice_period: NoticePeriod | None
    address: str | None
    photo: ProfilePhotoMetadata | None = None


class BioDataUpdateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    gender: Gender | None = None
    mobile: str
    dob: date | None = None
    location: str = Field(min_length=1)
    current_company: str | None = Field(default=None, max_length=150)
    notice_period: NoticePeriod | None = None
    address: str | None = Field(default=None, max_length=500)

    @field_validator("first_name", "last_name", "location", "current_company", "address")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v else v

    @field_validator("mobile")
    @classmethod
    def _mobile_format(cls, v: str) -> str:
        if not MOBILE_RE.match(v):
            raise ValueError("Invalid mobile number format")
        return v

    @field_validator("dob")
    @classmethod
    def _dob_valid(cls, v: date | None) -> date | None:
        if v is None:
            return v
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < MIN_CANDIDATE_AGE_YEARS:
            raise ValueError(f"Candidate must be at least {MIN_CANDIDATE_AGE_YEARS} years old")
        return v


# ----------------------------------------------------------------------
# Step 2 — Education (repeatable)
# ----------------------------------------------------------------------
class EducationInput(BaseModel):
    institution: str = Field(min_length=1, max_length=150)
    degree: str = Field(min_length=1, max_length=150)
    passing_year: int
    cgpa: Decimal = Field(ge=0, le=10, max_digits=4, decimal_places=2)

    @field_validator("institution", "degree")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class EducationItem(EducationInput):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


# ----------------------------------------------------------------------
# Step 3 — Work Experience (repeatable, or Fresher)
# ----------------------------------------------------------------------
class FresherStatusResponse(BaseModel):
    is_fresher: bool


class FresherStatusUpdateRequest(BaseModel):
    is_fresher: bool


class ExperienceInput(BaseModel):
    company: str = Field(min_length=1, max_length=150)
    title: str = Field(min_length=1, max_length=150)
    start_date: date
    currently_working: bool = False
    end_date: date | None = None
    responsibilities: str | None = None

    @field_validator("company", "title")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def _validate_dates(self):
        if self.start_date > date.today():
            raise ValueError("Experience start date cannot be in the future")

        if self.currently_working:
            if self.end_date is not None:
                raise ValueError("End date must be empty for your current role")
        else:
            if self.end_date is None:
                raise ValueError("End date is required unless this is your current role")
            if self.end_date > date.today():
                raise ValueError("Experience end date cannot be in the future")
            if self.end_date < self.start_date:
                raise ValueError("Experience end date cannot be before the start date")

        return self


class ExperienceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company: str
    title: str
    start_date: date
    end_date: date | None
    responsibilities: str | None
    currently_working: bool = False

    @model_validator(mode="before")
    @classmethod
    def _derive_currently_working(cls, data):
        if isinstance(data, dict):
            return data
        return {
            "id": data.id,
            "company": data.company,
            "title": data.title,
            "start_date": data.start_date,
            "end_date": data.end_date,
            "responsibilities": data.responsibilities,
            "currently_working": data.end_date is None,
        }


# ----------------------------------------------------------------------
# Step 4 — Resume Upload
# ----------------------------------------------------------------------
class ResumeMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_name: str
    mime_type: str
    size_bytes: int
    uploaded_at: datetime
    scan_status: ScanStatus


# ----------------------------------------------------------------------
# Step 5 — Review & Submit
# ----------------------------------------------------------------------
class ApplicationProgressJob(BaseModel):
    id: uuid.UUID
    title: str
    requisition_code: str
    department: str
    location: str
    status: JobStatus


class ApplicationProgressResponse(BaseModel):
    """Everything the Review step needs in one call: the job being applied
    to, the candidate's current profile snapshot, and whether an
    application already exists for this job/candidate pair."""

    job: ApplicationProgressJob
    bio: BioDataResponse
    education: list[EducationItem]
    experience: list[ExperienceItem]
    resume: ResumeMetadata | None
    is_fresher: bool = False
    already_applied: bool
    application_status: ApplicationStatus | None = None


MAX_COVER_NOTE_LENGTH = 2000


class ApplicationSubmitRequest(BaseModel):
    # consent is intentionally NOT validated here (M-3): a Pydantic
    # field_validator raising on False would reject the request at the
    # 422 (schema-validation) layer before it ever reaches the service,
    # even though "consent=False" is a perfectly well-typed, valid piece
    # of input — it's a *business rule* ("you may not submit without
    # consenting"), not a shape/type problem. ApplicationService.submit_application()
    # already checks `if not payload.consent` and raises a 400, which is
    # what the API contract/tests expect for this case. Keeping the check
    # at the service layer (not duplicating it here) means there's exactly
    # one place that decides the status code for this rule.
    consent: bool
    # Optional cover note, per BRD Step 4 (Resume Upload).
    cover_note: str | None = Field(default=None, max_length=MAX_COVER_NOTE_LENGTH)

    @field_validator("cover_note")
    @classmethod
    def _strip_cover_note(cls, v: str | None) -> str | None:
        if v is None:
            return v
        stripped = v.strip()
        return stripped or None


class ApplicationSubmitResponse(BaseModel):
    id: uuid.UUID
    application_code: str
    job_id: uuid.UUID
    status: ApplicationStatus
    applied_at: datetime


class MyApplicationItem(BaseModel):
    id: uuid.UUID
    application_code: str
    job_id: uuid.UUID
    job_title: str
    status: ApplicationStatus
    applied_at: datetime
