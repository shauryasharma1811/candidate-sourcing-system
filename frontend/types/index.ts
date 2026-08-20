export type UserRole = "Admin" | "Candidate";
export type JobStatus = "Draft" | "Published" | "Closed";
export type ApplicationStatus = "New" | "Reviewed" | "Shortlisted" | "Rejected";
export type EmploymentType = "Full-Time" | "Part-Time" | "Contract" | "Internship";

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
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string;
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
