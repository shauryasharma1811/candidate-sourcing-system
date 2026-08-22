export type UserRole = "Admin" | "Candidate";
export type JobStatus = "Draft" | "Published" | "Closed";
export type ApplicationStatus = "New" | "Reviewed" | "Shortlisted" | "Rejected";
export type EmploymentType = "Full-Time" | "Part-Time" | "Contract" | "Internship";
export type Gender = "Male" | "Female" | "Other" | "Prefer not to say";
export type NoticePeriod = "Immediate" | "15 Days" | "30 Days" | "60 Days" | "90 Days";

/** A card on the public job-listing page. */
export interface JobListItem {
  id: string;
  title: string;
  requisition_code: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  experience_required: string | null;
  openings: number;
  created_at: string;
}

/** The public job-detail page. */
export interface JobDetail extends JobListItem {
  description: string | null;
  requirements: string | null;
}

export interface PaginatedMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** Backend-authoritative filter options — only ever reflects Published jobs. */
export interface JobFilters {
  departments: string[];
  locations: string[];
  experience_levels: string[];
  employment_types: string[];
}

/** Admin dashboard summary cards. */
export interface DashboardStats {
  published_jobs: number;
  draft_jobs: number;
  closed_jobs: number;
  total_applications: number;
  new_applications: number;
}

/** Admin requisitions-table row — full requisition fields. */
export interface RequisitionListItem {
  id: string;
  title: string;
  requisition_code: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  experience_required: string | null;
  openings: number;
  hiring_manager: string;
  max_salary: number | null;
  hiring_completion_date: string | null;
  status: JobStatus;
  application_count: number;
  created_at: string;
  updated_at: string;
}

/** Full requisition record — Edit screen. */
export interface RequisitionDetail extends RequisitionListItem {
  description: string | null;
}

/** Create/Edit Requisition form payload. */
export interface RequisitionFormInput {
  title: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  experience_required: string | null;
  openings: number;
  hiring_manager: string;
  description: string | null;
  max_salary: number | null;
  hiring_completion_date: string | null;
  publish: boolean;
}

/** Admin applications-grid row. */
export interface ApplicationListItem {
  id: string;
  application_code: string;
  candidate_name: string;
  candidate_email: string;
  candidate_location: string | null;
  experience_summary: string;
  job_title: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string;
  resume: ResumeMetadata | null;
}

export type NotificationEvent = "application_submitted" | "submission_confirmation" | "status_change";
export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "read";

export interface NotificationListItem {
  id: string;
  event: NotificationEvent;
  status: NotificationDeliveryStatus;
  subject: string | null;
  application_id: string | null;
  created_at: string;
  read_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Guided application flow (candidate-facing)                          */
/* ------------------------------------------------------------------ */

/** Step 1 — Bio Data. */
export interface ProfilePhotoMetadata {
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface BioData {
  id: string;
  first_name: string;
  last_name: string;
  gender: Gender | null;
  email: string;
  mobile: string;
  dob: string | null; // ISO date (YYYY-MM-DD)
  location: string | null;
  current_company: string | null;
  notice_period: NoticePeriod | null;
  address: string | null;
  photo: ProfilePhotoMetadata | null;
}

export interface BioDataFormInput {
  first_name: string;
  last_name: string;
  gender: Gender | null;
  mobile: string;
  dob: string | null;
  location: string;
  current_company: string | null;
  notice_period: NoticePeriod | null;
  address: string | null;
}

/** Step 2 — Education (repeatable). */
export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  passing_year: number;
  cgpa: number;
}

export type EducationFormInput = Omit<EducationEntry, "id">;

/** Step 3 — Work Experience (repeatable). */
/** Step 3 — Work Experience (repeatable, or Fresher). */
export interface ExperienceEntry {
  id: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  responsibilities: string | null;
  currently_working: boolean;
}

export type ExperienceFormInput = Omit<ExperienceEntry, "id">;

/** Step 4 — Resume Upload. */
export type ScanStatus = "pending" | "clean" | "infected" | "failed";

export interface ResumeMetadata {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  scan_status: ScanStatus;
}

/** Step 5 — Review & Submit. */
export interface ApplicationProgressJob {
  id: string;
  title: string;
  requisition_code: string;
  department: string;
  location: string;
  status: JobStatus;
}

export interface ApplicationProgress {
  job: ApplicationProgressJob;
  bio: BioData;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  resume: ResumeMetadata | null;
  is_fresher: boolean;
  already_applied: boolean;
  application_status: ApplicationStatus | null;
}

export interface ApplicationSubmitResult {
  id: string;
  application_code: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string;
}

/** Candidate's own "My Applications" list. */
export interface MyApplicationItem {
  id: string;
  application_code: string;
  job_id: string;
  job_title: string;
  status: ApplicationStatus;
  applied_at: string;
}

/** One entry in an application's audit trail (submission, notifications, status changes). */
export interface TimelineEvent {
  event: string;
  label: string;
  at: string;
  actor: string | null;
}

/** Admin — "View full application" detail (candidate-history-screen requirement). */
export interface ApplicationDetail {
  id: string;
  application_code: string;
  status: ApplicationStatus;
  applied_at: string;
  reviewed_at: string | null;
  reviewed_by_admin_name: string | null;
  cover_note: string | null;
  job: ApplicationProgressJob;
  bio: BioData;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  is_fresher: boolean;
  experience_summary: string;
  resume: ResumeMetadata | null;
  timeline: TimelineEvent[];
}

export interface ResumeDownloadLink {
  url: string;
  expires_in_seconds: number;
}
