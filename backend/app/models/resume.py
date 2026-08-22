import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Enum as SAEnum, ForeignKey, String, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import ScanStatus
from app.common.mixins import UUIDPrimaryKeyMixin
from app.db.session import Base


class Resume(UUIDPrimaryKeyMixin, Base):
    """
    Resume storage metadata only. The physical file lives in S3-compatible
    storage; `generated_filename` is the internal object key. Storage paths
    are never exposed to API clients — only metadata is returned.
    """
    __tablename__ = "resumes"

    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"))
    generated_filename: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_bucket: Mapped[str] = mapped_column(String(150), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    # --- Virus scan (placeholder scanner today — see virus_scan_service) ---
    scan_status: Mapped[ScanStatus] = mapped_column(
    SAEnum(
        ScanStatus,
        name="resume_scan_status",
        values_callable=lambda enum: [e.value for e in enum],
    ),
    nullable=False,
    default=ScanStatus.PENDING,
    )
    scanned_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    scan_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # --- Retention policy ---
    # When this row becomes eligible for purge. Computed at upload time from
    # settings.RESUME_RETENTION_DAYS; the S3 object's own lifecycle rule is
    # the storage-layer backstop for the same policy (see storage_service).
    retention_expires_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    purged_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    candidate = relationship("Candidate", back_populates="resumes")
    application = relationship("Application", back_populates="resume", uselist=False)
