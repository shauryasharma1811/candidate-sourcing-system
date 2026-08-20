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


class ApplicationStatus(str, Enum):
    NEW = "New"
    REVIEWED = "Reviewed"
    SHORTLISTED = "Shortlisted"
    REJECTED = "Rejected"


class NotificationEvent(str, Enum):
    APPLICATION_SUBMITTED = "application_submitted"   # -> Admin
    SUBMISSION_CONFIRMATION = "submission_confirmation"  # -> Candidate
    STATUS_CHANGE = "status_change"                    # -> Candidate (future-ready)
