import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, String, TIMESTAMP, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import NotificationEvent
from app.common.mixins import UUIDPrimaryKeyMixin
from app.db.session import Base
from enum import Enum


class NotificationChannel(str, Enum):
    EMAIL = "email"
    IN_APP = "in_app"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    READ = "read"


class Notification(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "(admin_recipient_id IS NOT NULL)::INT + (candidate_recipient_id IS NOT NULL)::INT = 1",
            name="ck_notifications_exactly_one_recipient",
        ),
    )

    event: Mapped[NotificationEvent] = mapped_column(
    SAEnum(
        NotificationEvent,
        name="notification_event",
        values_callable=lambda x: [e.value for e in x],
    ),
    nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
    SAEnum(
        NotificationChannel,
        name="notification_channel",
        values_callable=lambda x: [e.value for e in x],
    ),
    nullable=False,
    )

    status: Mapped[NotificationStatus] = mapped_column(
        SAEnum(
            NotificationStatus,
            name="notification_status",
            values_callable=lambda x: [e.value for e in x],
        ),
    nullable=False,
    default=NotificationStatus.PENDING,
    )

    admin_recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("admins.id", ondelete="CASCADE"), nullable=True)
    candidate_recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True)

    subject: Mapped[str] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sent_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    read_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    admin_recipient = relationship("Admin")
    candidate_recipient = relationship("Candidate")
    application = relationship("Application", back_populates="notifications")
