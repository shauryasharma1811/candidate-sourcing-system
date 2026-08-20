"""
Auth business logic. Controllers (app/api/v1/routes/auth.py) call into this
module only; this module is the only place allowed to combine repositories,
enforce business rules, and issue tokens.
"""
import secrets
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.enums import UserRole
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.candidate import Candidate
from app.models.user import User
from app.repositories.password_reset_repository import PasswordResetTokenRepository
from app.repositories.profile_repository import AdminRepository, CandidateRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import CandidateRegisterRequest, TokenPairResponse
from app.services.notification_service import send_password_reset_email


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)
        self.candidates = CandidateRepository(db)
        self.admins = AdminRepository(db)
        self.reset_tokens = PasswordResetTokenRepository(db)

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    def register_candidate(self, payload: CandidateRegisterRequest) -> TokenPairResponse:
        if self.users.email_exists(payload.email):
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

        user = User(
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            role=UserRole.CANDIDATE,
        )
        self.db.add(user)
        self.db.flush()  # get user.id without committing yet

        candidate = Candidate(
            user_id=user.id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            mobile=payload.mobile,
            location=payload.location,
            consent=payload.consent,
        )
        self.db.add(candidate)
        self.db.commit()
        self.db.refresh(user)

        return self._issue_token_pair(user)

    # ------------------------------------------------------------------
    # Login (shared by candidate + admin — role is derived from the account)
    # ------------------------------------------------------------------
    def authenticate(self, email: str, password: str, intended_job_id: uuid.UUID | None = None) -> TokenPairResponse:
        user = self.users.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            # Same error for unknown email vs wrong password — avoid user enumeration
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

        return self._issue_token_pair(user, intended_job_id)

    def authenticate_admin(self, email: str, password: str) -> TokenPairResponse:
        user = self.users.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
        if user.role != UserRole.ADMIN:
            # Deliberately generic — don't reveal that the email belongs to a candidate account
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

        return self._issue_token_pair(user)

    # ------------------------------------------------------------------
    # Refresh
    # ------------------------------------------------------------------
    def refresh(self, refresh_token: str) -> TokenPairResponse:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

        user = self.db.get(User, payload.get("sub"))
        if not user or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

        return self._issue_token_pair(user)

    # ------------------------------------------------------------------
    # Forgot / reset password
    # ------------------------------------------------------------------
    def request_password_reset(self, email: str) -> None:
        user = self.users.get_by_email(email)
        if not user:
            # Always return success shape — do not reveal whether the email exists
            return
        raw_token = secrets.token_urlsafe(32)
        self.reset_tokens.create_for_user(user.id, raw_token)
        send_password_reset_email(user.email, raw_token)

    def reset_password(self, raw_token: str, new_password: str) -> None:
        token = self.reset_tokens.get_valid_by_raw_token(raw_token)
        if not token:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reset link is invalid or has expired")

        user = self.db.get(User, token.user_id)
        if not user:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reset link is invalid or has expired")

        user.password_hash = hash_password(new_password)
        self.db.commit()
        self.reset_tokens.mark_used(token)

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------
    def get_profile(self, user: User) -> dict:
        if user.role == UserRole.CANDIDATE:
            candidate = self.candidates.get_by_user_id(user.id)
            first_name, last_name = (candidate.first_name, candidate.last_name) if candidate else ("", "")
        else:
            admin = self.admins.get_by_user_id(user.id)
            first_name, last_name = (admin.first_name, admin.last_name) if admin else ("", "")

        return {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "first_name": first_name,
            "last_name": last_name,
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------
    def _issue_token_pair(self, user: User, intended_job_id: uuid.UUID | None = None) -> TokenPairResponse:
        from app.core.config import settings

        access_token = create_access_token(subject=str(user.id), role=user.role.value)
        refresh_token = create_refresh_token(subject=str(user.id))

        redirect_to = f"/jobs/{intended_job_id}/apply" if intended_job_id else None

        return TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            redirect_to=redirect_to,
        )
