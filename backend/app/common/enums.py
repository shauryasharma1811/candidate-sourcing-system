from enum import Enum


class UserRole(str, Enum):
    ADMIN = "Admin"
    CANDIDATE = "Candidate"


class JobStatus(str, Enum):
    DRAFT = "Draft"
    PUBLISHED = "Published"
    CLOSED = "Closed"


class EmploymentType(str, Enum):
    FULL_TIME = "Full-Time"
    PART_TIME = "Part-Time"
    CONTRACT = "Contract"
    INTERNSHIP = "Internship"


class Gender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    OTHER = "Other"
    PREFER_NOT_TO_SAY = "Prefer not to say"


class NoticePeriod(str, Enum):
    IMMEDIATE = "Immediate"
    FIFTEEN_DAYS = "15 Days"
    THIRTY_DAYS = "30 Days"
    SIXTY_DAYS = "60 Days"
    NINETY_DAYS = "90 Days"


class ApplicationStatus(str, Enum):
    NEW = "New"
    REVIEWED = "Reviewed"
    SHORTLISTED = "Shortlisted"
    REJECTED = "Rejected"


class NotificationEvent(str, Enum):
    APPLICATION_SUBMITTED = "application_submitted"   # -> Admin
    SUBMISSION_CONFIRMATION = "submission_confirmation"  # -> Candidate
    STATUS_CHANGE = "status_change"                    # -> Candidate (future-ready)


class ScanStatus(str, Enum):
    """Virus-scan lifecycle for an uploaded file. PENDING is set the
    instant a file lands in storage but before a scan verdict exists;
    today's placeholder scanner resolves this synchronously so uploads
    only ever reach CLEAN or INFECTED/FAILED, but the PENDING state is
    what a real async scanner (ClamAV daemon, S3 Object Lambda, etc.)
    would sit in between upload and verdict."""

    PENDING = "pending"
    CLEAN = "clean"
    INFECTED = "infected"
    FAILED = "failed"
