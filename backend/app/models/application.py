import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import ApplicationStatus
from app.common.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.session import Base


class Application(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("candidate_id", "job_id", name="uq_applications_candidate_job"),)

    # Human-readable Application ID (APP-<year>-<seq>) surfaced to the
    # candidate on the confirmation page and in the submission email.
    # Distinct from the internal UUID `id` — see ApplicationService._generate_application_code.
    application_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_requisitions.id", ondelete="CASCADE"))
    resume_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="RESTRICT"))
    status: Mapped[ApplicationStatus] = mapped_column(
        SAEnum(ApplicationStatus, name="application_status"), nullable=False, default=ApplicationStatus.NEW
    )
    consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Step 4 (Resume Upload) per BRD: "Optional cover note."
    cover_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_by_admin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    candidate = relationship("Candidate", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    resume = relationship("Resume", back_populates="application")
    reviewed_by_admin = relationship("Admin")
    notifications = relationship("Notification", back_populates="application")
