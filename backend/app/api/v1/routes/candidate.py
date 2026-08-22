from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_role
from app.common.enums import UserRole
from app.db.session import get_db
from app.models.user import User
from app.schemas.candidate import BioDataUpdateRequest, EducationInput, ExperienceInput, FresherStatusUpdateRequest
from app.schemas.response import SuccessResponse
from app.services.candidate_profile_service import CandidateProfileService

router = APIRouter(
    prefix="/candidate",
    tags=["candidate profile"],
    dependencies=[Depends(require_role(UserRole.CANDIDATE))],
)


# ----------------------------------------------------------------------
# Step 1 — Bio Data
# ----------------------------------------------------------------------
@router.get("/profile", response_model=SuccessResponse)
def get_bio(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = CandidateProfileService(db).get_bio(current_user)
    return SuccessResponse(message="Profile retrieved", data=data)


@router.put("/profile", response_model=SuccessResponse)
def update_bio(
    payload: BioDataUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = CandidateProfileService(db).update_bio(current_user, payload)
    return SuccessResponse(message="Profile saved", data=data)


@router.post("/profile/photo", response_model=SuccessResponse)
def upload_profile_photo(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = CandidateProfileService(db).upload_profile_photo(current_user, file)
    return SuccessResponse(message="Photo uploaded", data=data)


# ----------------------------------------------------------------------
# Step 2 — Education
# ----------------------------------------------------------------------
@router.get("/education", response_model=SuccessResponse)
def list_education(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = CandidateProfileService(db).list_education(current_user)
    return SuccessResponse(message="Education retrieved", data=data)


@router.post("/education", response_model=SuccessResponse)
def add_education(
    payload: EducationInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = CandidateProfileService(db).add_education(current_user, payload)
    return SuccessResponse(message="Education added", data=data)


@router.put("/education/{education_id}", response_model=SuccessResponse)
def update_education(
    education_id: str,
    payload: EducationInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = CandidateProfileService(db).update_education(current_user, education_id, payload)
    return SuccessResponse(message="Education updated", data=data)


@router.delete("/education/{education_id}", response_model=SuccessResponse)
def delete_education(
    education_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    CandidateProfileService(db).delete_education(current_user, education_id)
    return SuccessResponse(message="Education removed", data=None)


# ----------------------------------------------------------------------
# Step 3 — Work Experience
# ----------------------------------------------------------------------
@router.get("/experience", response_model=SuccessResponse)
def list_experience(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = CandidateProfileService(db).list_experience(current_user)
    return SuccessResponse(message="Experience retrieved", data=data)


@router.post("/experience", response_model=SuccessResponse)
def add_experience(
    payload: ExperienceInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = CandidateProfileService(db).add_experience(current_user, payload)
    return SuccessResponse(message="Experience added", data=data)


@router.get("/experience/fresher-status", response_model=SuccessResponse)
def get_fresher_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = CandidateProfileService(db).get_fresher_status(current_user)
    return SuccessResponse(message="Fresher status retrieved", data=data)


@router.put("/experience/fresher-status", response_model=SuccessResponse)
def set_fresher_status(
    payload: FresherStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = CandidateProfileService(db).set_fresher_status(current_user, payload)
    return SuccessResponse(message="Fresher status saved", data=data)


@router.put("/experience/{experience_id}", response_model=SuccessResponse)
def update_experience(
    experience_id: str,
    payload: ExperienceInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = CandidateProfileService(db).update_experience(current_user, experience_id, payload)
    return SuccessResponse(message="Experience updated", data=data)


@router.delete("/experience/{experience_id}", response_model=SuccessResponse)
def delete_experience(
    experience_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    CandidateProfileService(db).delete_experience(current_user, experience_id)
    return SuccessResponse(message="Experience removed", data=None)
