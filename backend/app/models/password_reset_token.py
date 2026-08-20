import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.mixins import UUIDPrimaryKeyMixin
from app.db.session import Base


class PasswordResetToken(UUIDPrimaryKeyMixin, Base):
    """
    One-time-use password reset tokens. We store a hash of the token, never
    the raw value — mirrors how password_hash is never the plaintext.
    """
    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    used_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    user = relationship("User")

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and self.expires_at > datetime.now(self.expires_at.tzinfo)
