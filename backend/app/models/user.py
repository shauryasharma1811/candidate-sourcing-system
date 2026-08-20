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

    candidate: Mapped["Candidate"] = relationship(back_populates="user", uselist=False)  # noqa: F821
    admin: Mapped["Admin"] = relationship(back_populates="user", uselist=False)  # noqa: F821
