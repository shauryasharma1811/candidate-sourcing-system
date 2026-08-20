import re
import uuid

from pydantic import BaseModel, EmailStr, field_validator

MOBILE_RE = re.compile(r"^\+?[0-9]{7,15}$")


class CandidateRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    mobile: str
    location: str | None = None
    consent: bool = False

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v) or not re.search(r"[a-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain upper, lower, and numeric characters")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if len(v) > 50:
            raise ValueError("Name must be 50 characters or fewer")
        return v

    @field_validator("mobile")
    @classmethod
    def mobile_format(cls, v: str) -> str:
        if not MOBILE_RE.match(v):
            raise ValueError("Invalid mobile number format")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    # Optional: job the candidate was trying to reach before being redirected to login
    intended_job_id: uuid.UUID | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v) or not re.search(r"[a-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain upper, lower, and numeric characters")
        return v


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    redirect_to: str | None = None  # job the candidate should return to, if any


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: str
    first_name: str
    last_name: str
