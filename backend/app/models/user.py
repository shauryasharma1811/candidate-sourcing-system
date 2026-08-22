from sqlalchemy import Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, Relationship, mapped_column, relationship

from app.common.enums import UserRole
from app.common.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.session import Base


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), nullable=False)
    # Present in sql/schema.sql and the 0001 migration but was missing here —
    # auth_service.authenticate()/authenticate_admin() read this on every
    # login, so without it every login raised AttributeError.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    candidate: Mapped["Candidate"] = relationship(back_populates="user", uselist=False)  # noqa: F821
    admin: Mapped["Admin"] = relationship(back_populates="user", uselist=False)  # noqa: F821
