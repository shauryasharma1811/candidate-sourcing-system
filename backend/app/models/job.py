import uuid
from datetime import date

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import EmploymentType, JobStatus
from app.common.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.session import Base


class Job(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "job_requisitions"

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    requisition_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    employment_type: Mapped[EmploymentType] = mapped_column(SAEnum(EmploymentType, name="employment_type"), nullable=False)
    experience_required: Mapped[str] = mapped_column(String(50), nullable=True)
    openings: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    hiring_manager: Mapped[str] = mapped_column(String(150), nullable=False)
    max_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=True)
    hiring_completion_date: Mapped[date] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    requirements: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[JobStatus] = mapped_column(SAEnum(JobStatus, name="job_status"), nullable=False, default=JobStatus.DRAFT)
    created_by_admin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    applications = relationship("Application", back_populates="job")
    created_by_admin = relationship("Admin")
