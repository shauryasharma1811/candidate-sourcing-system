import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.common.enums import EmploymentType, JobStatus


class RequisitionInput(BaseModel):
    """Fields collected on the Create/Edit Requisition screen. Shared by
    create and update so both endpoints enforce identical backend
    validation (per contract: validation is backend-authoritative)."""

    title: str = Field(min_length=1, max_length=150)
    department: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=150)
    employment_type: EmploymentType
    experience_required: str | None = Field(default=None, max_length=50)
    openings: int = Field(ge=1, le=999)
    hiring_manager: str = Field(min_length=1, max_length=150)
    description: str | None = None
    max_salary: float | None = Field(default=None, ge=0)
    hiring_completion_date: date | None = None

    @field_validator("title", "department", "location", "hiring_manager", "experience_required")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v else v

    @field_validator("hiring_completion_date")
    @classmethod
    def _not_in_past(cls, v: date | None) -> date | None:
        if v is not None and v < date.today():
            raise ValueError("Hiring completion date cannot be in the past")
        return v


class RequisitionCreateRequest(RequisitionInput):
    publish: bool = False


class RequisitionUpdateRequest(RequisitionInput):
    publish: bool = False


class RequisitionListItem(BaseModel):
    """Admin requisitions-table row. Unlike the public job schema, this
    includes every requisition field (status, hiring manager, salary,
    hiring-completion date) since the admin is the authority reviewing them."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    requisition_code: str
    department: str
    location: str
    employment_type: EmploymentType
    experience_required: str | None
    openings: int
    hiring_manager: str
    max_salary: float | None
    hiring_completion_date: date | None
    status: JobStatus
    application_count: int = 0
    created_at: datetime
    updated_at: datetime


class RequisitionDetail(RequisitionListItem):
    """Full requisition record for the Edit screen — adds the long-form
    description that the table row doesn't need."""

    description: str | None
