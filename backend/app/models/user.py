from sqlalchemy import Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, Relationship, mapped_column, relationship
from typing import TYPE_CHECKING
from app.common.enums import UserRole
from app.common.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.session import Base
if TYPE_CHECKING:
    from app.models.admin import Admin
    from app.models.candidate import Candidate

class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            name="user_role",
            values_callable=lambda enum: [e.value for e in enum],
        ),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    candidate: Mapped["Candidate"] = relationship(
        "Candidate",
        back_populates="user",
        uselist=False,
    )

    admin: Mapped["Admin"] = relationship(
        "Admin",
        back_populates="user",
        uselist=False,
    )
