"""
Thin controllers: parse request -> call AuthService -> wrap in standard envelope.
No business logic here.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    CandidateRegisterRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPairResponse,
    UserProfileResponse,
)
from app.schemas.response import SuccessResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=SuccessResponse[TokenPairResponse], status_code=201)
def register(payload: CandidateRegisterRequest, db: Session = Depends(get_db)):
    tokens = AuthService(db).register_candidate(payload)
    return SuccessResponse(message="Account created", data=tokens)


@router.post("/login", response_model=SuccessResponse[TokenPairResponse])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    tokens = AuthService(db).authenticate(payload.email, payload.password, payload.intended_job_id)
    return SuccessResponse(message="Logged in", data=tokens)


@router.post("/admin/login", response_model=SuccessResponse[TokenPairResponse])
def admin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    tokens = AuthService(db).authenticate_admin(payload.email, payload.password)
    return SuccessResponse(message="Logged in", data=tokens)


@router.post("/refresh", response_model=SuccessResponse[TokenPairResponse])
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    tokens = AuthService(db).refresh(payload.refresh_token)
    return SuccessResponse(message="Token refreshed", data=tokens)


@router.post("/forgot-password", response_model=SuccessResponse[None])
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    AuthService(db).request_password_reset(payload.email)
    return SuccessResponse(message="If that email exists, a reset link has been sent", data=None)


@router.post("/reset-password", response_model=SuccessResponse[None])
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    AuthService(db).reset_password(payload.token, payload.new_password)
    return SuccessResponse(message="Password has been reset", data=None)


@router.get("/me", response_model=SuccessResponse[UserProfileResponse])
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = AuthService(db).get_profile(current_user)
    return SuccessResponse(message="ok", data=profile)
