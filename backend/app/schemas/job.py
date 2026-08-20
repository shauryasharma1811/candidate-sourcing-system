import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.common.enums import EmploymentType
from app.schemas.common import PaginatedMeta

__all__ = ["JobPublicListItem", "JobPublicDetail", "PaginatedMeta", "JobFiltersResponse"]


class JobPublicListItem(BaseModel):
    """A single card on the public job-listing page. Deliberately excludes
    internal-only requisition fields (hiring manager, salary, hiring
    completion date) — the careers site only ever shows what a candidate
    is meant to see."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    requisition_code: str
    department: str
    location: str
    employment_type: EmploymentType
    experience_required: str | None
    openings: int
    created_at: datetime


class JobPublicDetail(JobPublicListItem):
    """Full public job-detail page. Adds description and requirements as
    distinct sections; still excludes hiring manager and salary, which
    remain admin-only per contract."""

    description: str | None
    requirements: str | None


class JobFiltersResponse(BaseModel):
    """Backend-authoritative filter facets, derived only from currently
    Published jobs, so the frontend never offers a filter combination
    that returns zero results."""

    departments: list[str]
    locations: list[str]
    experience_levels: list[str]
    employment_types: list[str]
