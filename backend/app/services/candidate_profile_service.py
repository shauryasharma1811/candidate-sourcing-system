"""
Business logic for Steps 1-3 of the guided application flow. Education and
Experience live on the Candidate's persistent profile (shared across every
application), so each of these calls IS the "save this step" action — there
is no separate draft/commit step.
"""
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.candidate import Candidate, Education, Experience
from app.models.user import User
from app.repositories.profile_repository import CandidateRepository, EducationRepository, ExperienceRepository
from app.schemas.candidate import (
    BioDataResponse,
    BioDataUpdateRequest,
    EducationInput,
    EducationItem,
    ExperienceInput,
    ExperienceItem,
    FresherStatusResponse,
    FresherStatusUpdateRequest,
    ProfilePhotoMetadata,
)
from app.services import storage_service

ALLOWED_PHOTO_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024  # 5MB


class CandidateProfileService:
    def __init__(self, db: Session):
        self.db = db
        self.candidates = CandidateRepository(db)
        self.education = EducationRepository(db)
        self.experience = ExperienceRepository(db)

    def _get_candidate_or_404(self, user: User) -> Candidate:
        candidate = self.candidates.get_by_user_id(user.id)
        if not candidate:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidate profile not found")
        return candidate

    # ------------------------------------------------------------------
    # Step 1 — Bio Data
    # ------------------------------------------------------------------
    def get_bio(self, user: User) -> BioDataResponse:
        candidate = self._get_candidate_or_404(user)
        return self._to_bio_response(candidate, user)

    def update_bio(self, user: User, payload: BioDataUpdateRequest) -> BioDataResponse:
        candidate = self._get_candidate_or_404(user)
        candidate.first_name = payload.first_name
        candidate.last_name = payload.last_name
        candidate.gender = payload.gender
        candidate.mobile = payload.mobile
        candidate.dob = payload.dob
        candidate.location = payload.location
        candidate.current_company = payload.current_company
        candidate.notice_period = payload.notice_period
        candidate.address = payload.address
        candidate = self.candidates.update(candidate)
        return self._to_bio_response(candidate, user)

    def upload_profile_photo(self, user: User, file: UploadFile) -> BioDataResponse:
        candidate = self._get_candidate_or_404(user)

        if file.content_type not in ALLOWED_PHOTO_MIME_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Photo must be a JPEG, PNG, or WEBP image")

        contents_size = file.size
        if contents_size is not None and contents_size > MAX_PHOTO_SIZE_BYTES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Photo must be 5MB or smaller")
        if contents_size == 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Photo file is empty")

        old_key = candidate.photo_generated_filename
        object_key = storage_service.build_photo_object_key(candidate.id, file.filename or "photo")
        storage_service.upload_photo(file, object_key)

        candidate.photo_generated_filename = object_key
        candidate.photo_original_name = file.filename or "photo"
        candidate.photo_mime_type = file.content_type
        candidate.photo_size_bytes = contents_size or 0
        candidate = self.candidates.update(candidate)

        if old_key:
            storage_service.delete_photo(old_key)

        return self._to_bio_response(candidate, user)

    def _to_bio_response(self, candidate: Candidate, user: User) -> BioDataResponse:
        photo = None
        if candidate.photo_generated_filename:
            photo = ProfilePhotoMetadata(
                original_name=candidate.photo_original_name,
                mime_type=candidate.photo_mime_type,
                size_bytes=candidate.photo_size_bytes,
            )
        return BioDataResponse(
            id=candidate.id,
            first_name=candidate.first_name,
            last_name=candidate.last_name,
            gender=candidate.gender,
            email=user.email,
            mobile=candidate.mobile,
            dob=candidate.dob,
            location=candidate.location,
            current_company=candidate.current_company,
            notice_period=candidate.notice_period,
            address=candidate.address,
            photo=photo,
        )

    # ------------------------------------------------------------------
    # Step 2 — Education
    # ------------------------------------------------------------------
    def list_education(self, user: User) -> list[EducationItem]:
        candidate = self._get_candidate_or_404(user)
        return [EducationItem.model_validate(e) for e in self.education.list_for_candidate(candidate.id)]

    def add_education(self, user: User, payload: EducationInput) -> EducationItem:
        candidate = self._get_candidate_or_404(user)
        entry = Education(candidate_id=candidate.id, **payload.model_dump())
        entry = self.education.create(entry)
        return EducationItem.model_validate(entry)

    def update_education(self, user: User, education_id: str, payload: EducationInput) -> EducationItem:
        candidate = self._get_candidate_or_404(user)
        entry = self._get_education_or_404(education_id, candidate.id)
        for field, value in payload.model_dump().items():
            setattr(entry, field, value)
        entry = self.education.update(entry)
        return EducationItem.model_validate(entry)

    def delete_education(self, user: User, education_id: str) -> None:
        candidate = self._get_candidate_or_404(user)
        entry = self._get_education_or_404(education_id, candidate.id)
        self.education.delete(entry)

    def _get_education_or_404(self, education_id: str, candidate_id: uuid.UUID) -> Education:
        try:
            education_uuid = uuid.UUID(education_id)
        except ValueError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Education entry not found")
        entry = self.education.get_for_candidate(education_uuid, candidate_id)
        if not entry:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Education entry not found")
        return entry

    # ------------------------------------------------------------------
    # Step 3 — Work Experience
    # ------------------------------------------------------------------
    def list_experience(self, user: User) -> list[ExperienceItem]:
        candidate = self._get_candidate_or_404(user)
        return [ExperienceItem.model_validate(e) for e in self.experience.list_for_candidate(candidate.id)]

    def add_experience(self, user: User, payload: ExperienceInput) -> ExperienceItem:
        candidate = self._get_candidate_or_404(user)
        entry = Experience(candidate_id=candidate.id, **payload.model_dump(exclude={"currently_working"}))
        entry = self.experience.create(entry)
        return ExperienceItem.model_validate(entry)

    def update_experience(self, user: User, experience_id: str, payload: ExperienceInput) -> ExperienceItem:
        candidate = self._get_candidate_or_404(user)
        entry = self._get_experience_or_404(experience_id, candidate.id)
        for field, value in payload.model_dump(exclude={"currently_working"}).items():
            setattr(entry, field, value)
        entry = self.experience.update(entry)
        return ExperienceItem.model_validate(entry)

    def delete_experience(self, user: User, experience_id: str) -> None:
        candidate = self._get_candidate_or_404(user)
        entry = self._get_experience_or_404(experience_id, candidate.id)
        self.experience.delete(entry)

    def _get_experience_or_404(self, experience_id: str, candidate_id: uuid.UUID) -> Experience:
        try:
            experience_uuid = uuid.UUID(experience_id)
        except ValueError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Experience entry not found")
        entry = self.experience.get_for_candidate(experience_uuid, candidate_id)
        if not entry:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Experience entry not found")
        return entry

    # ------------------------------------------------------------------
    # Step 3 — Fresher flag ("Experience: repeatable or Fresher" per BRD)
    # ------------------------------------------------------------------
    def get_fresher_status(self, user: User) -> FresherStatusResponse:
        candidate = self._get_candidate_or_404(user)
        return FresherStatusResponse(is_fresher=candidate.is_fresher)

    def set_fresher_status(self, user: User, payload: FresherStatusUpdateRequest) ->             FresherStatusResponse:
        candidate = self._get_candidate_or_404(user)

        candidate.is_fresher = payload.is_fresher
        candidate = self.candidates.update(candidate)

    # BRD: Candidate is either Fresher OR has Experience.
    # When marking as fresher, remove all saved experience entries.
        if payload.is_fresher:
            experiences = self.experience.list_for_candidate(candidate.id)
            for exp in experiences:
                self.experience.delete(exp)

        return FresherStatusResponse(is_fresher=candidate.is_fresher)
