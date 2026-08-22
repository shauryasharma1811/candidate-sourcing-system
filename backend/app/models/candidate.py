import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import Gender, NoticePeriod
from app.common.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.session import Base


class Candidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "candidates"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    location: Mapped[str] = mapped_column(Text, nullable=True)
    consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_fresher: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # --- Step 1 — Bio Data (extended fields) ---
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender, name="gender"), nullable=True)
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_company: Mapped[str | None] = mapped_column(String(150), nullable=True)
    notice_period: Mapped[NoticePeriod | None] = mapped_column(Enum(NoticePeriod, name="notice_period"), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Profile photo — metadata only, mirrors Resume's storage pattern; the
    # physical file lives in S3-compatible storage, never exposed as a path.
    photo_generated_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    photo_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    user = relationship("User", back_populates="candidate")
    education_entries = relationship("Education", back_populates="candidate", cascade="all, delete-orphan")
    experience_entries = relationship("Experience", back_populates="candidate", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="candidate")
    resumes = relationship("Resume", back_populates="candidate", cascade="all, delete-orphan")


class Education(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "education"

    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"))
    institution: Mapped[str] = mapped_column(String(150), nullable=False)
    degree: Mapped[str] = mapped_column(String(150), nullable=False)
    passing_year: Mapped[int] = mapped_column(nullable=False)
    cgpa: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)  # 0.00–10.00 scale

    candidate = relationship("Candidate", back_populates="education_entries")


class Experience(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "experience"

    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"))
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=True)  # null = current role; end>=start validated in service
    responsibilities: Mapped[str] = mapped_column(Text, nullable=True)

    candidate = relationship("Candidate", back_populates="experience_entries")
