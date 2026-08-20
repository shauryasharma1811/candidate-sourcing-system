-- ============================================================================
-- Candidate Sourcing System — PostgreSQL Schema
-- Derived strictly from Candidate_Sourcing_BRD_Compact_AI_Contract.docx
-- and PROJECT_Compact_AI_Contract.docx
--
-- Apply with:  psql -U css_user -d css_db -f schema.sql
-- (Mirrored as an Alembic migration in alembic/versions/ — see 0001_init_schema.py)
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('Admin', 'Candidate');

CREATE TYPE job_status AS ENUM ('Draft', 'Published', 'Closed');

CREATE TYPE employment_type AS ENUM ('Full-Time', 'Part-Time', 'Contract', 'Internship');

CREATE TYPE application_status AS ENUM ('New', 'Reviewed', 'Shortlisted', 'Rejected');

CREATE TYPE notification_event AS ENUM (
    'application_submitted',      -- -> Admin
    'submission_confirmation',    -- -> Candidate
    'status_change'               -- -> Candidate (future-ready)
);

CREATE TYPE notification_channel AS ENUM ('email', 'in_app');

CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'read');

-- ============================================================================
-- USERS  (authentication identity — shared by Admin and Candidate)
-- ============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_role ON users (role);

-- ============================================================================
-- ADMINS  (1:1 extension of users where role = 'Admin')
-- ============================================================================

CREATE TABLE admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    department      VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_admins_user_id UNIQUE (user_id),
    CONSTRAINT fk_admins_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_admins_user_id ON admins (user_id);

-- ============================================================================
-- CANDIDATES  (1:1 extension of users where role = 'Candidate')
-- ============================================================================

CREATE TABLE candidates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    mobile          VARCHAR(20) NOT NULL,
    location        TEXT,
    consent         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_candidates_user_id UNIQUE (user_id),
    CONSTRAINT fk_candidates_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_candidates_name_length
        CHECK (char_length(first_name) <= 50 AND char_length(last_name) <= 50),
    CONSTRAINT ck_candidates_mobile_format
        CHECK (mobile ~ '^\+?[0-9]{7,15}$')
);

CREATE INDEX ix_candidates_user_id ON candidates (user_id);
CREATE INDEX ix_candidates_name ON candidates (last_name, first_name);

-- ============================================================================
-- EDUCATION  (repeatable, belongs to a candidate)
-- ============================================================================

CREATE TABLE education (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL,
    institution     VARCHAR(150) NOT NULL,
    degree          VARCHAR(150) NOT NULL,
    field_of_study  VARCHAR(150),
    start_year      SMALLINT NOT NULL,
    end_year        SMALLINT,                 -- NULL = in progress
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_education_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    -- BRD Rule: "Education year not future"
    CONSTRAINT ck_education_start_not_future
        CHECK (start_year <= EXTRACT(YEAR FROM now())::SMALLINT),
    CONSTRAINT ck_education_end_not_future
        CHECK (end_year IS NULL OR end_year <= EXTRACT(YEAR FROM now())::SMALLINT),
    CONSTRAINT ck_education_end_after_start
        CHECK (end_year IS NULL OR end_year >= start_year)
);

CREATE INDEX ix_education_candidate_id ON education (candidate_id);

-- ============================================================================
-- EXPERIENCE  (repeatable, belongs to a candidate)
-- ============================================================================

CREATE TABLE experience (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL,
    company         VARCHAR(150) NOT NULL,
    title           VARCHAR(150) NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE,                     -- NULL = current role
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_experience_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    -- BRD Rule: "Experience end >= start"
    CONSTRAINT ck_experience_end_after_start
        CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ix_experience_candidate_id ON experience (candidate_id);

-- ============================================================================
-- JOB REQUISITIONS
-- ============================================================================

CREATE TABLE job_requisitions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                       VARCHAR(150) NOT NULL,
    requisition_code            VARCHAR(50) NOT NULL,
    department                  VARCHAR(100) NOT NULL,
    location                    VARCHAR(150) NOT NULL,
    employment_type             employment_type NOT NULL,
    experience_required         VARCHAR(50),
    openings                    INTEGER NOT NULL DEFAULT 1,
    hiring_manager              VARCHAR(150) NOT NULL,
    max_salary                  NUMERIC(12, 2),
    hiring_completion_date      DATE,
    description                 TEXT,
    status                      job_status NOT NULL DEFAULT 'Draft',
    created_by_admin_id         UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_job_requisitions_code UNIQUE (requisition_code),
    CONSTRAINT fk_job_requisitions_admin
        FOREIGN KEY (created_by_admin_id) REFERENCES admins (id) ON DELETE SET NULL,
    CONSTRAINT ck_job_requisitions_openings_positive CHECK (openings > 0),
    CONSTRAINT ck_job_requisitions_salary_positive CHECK (max_salary IS NULL OR max_salary >= 0)
);

CREATE INDEX ix_job_requisitions_status ON job_requisitions (status);
CREATE INDEX ix_job_requisitions_department ON job_requisitions (department);
CREATE INDEX ix_job_requisitions_location ON job_requisitions (location);
-- Supports the public "browse published jobs, paginated" query
CREATE INDEX ix_job_requisitions_status_created_at ON job_requisitions (status, created_at DESC);
-- Basic full text search across title (BRD: search/filters on public careers page)
CREATE INDEX ix_job_requisitions_title_trgm ON job_requisitions USING gin (to_tsvector('english', title));

-- ============================================================================
-- RESUME STORAGE  (metadata only — physical file lives in S3-compatible storage;
-- storage path/key is never exposed to API clients)
-- ============================================================================

CREATE TABLE resumes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL,
    generated_filename  VARCHAR(255) NOT NULL,   -- internal storage key / object name
    original_name       VARCHAR(255) NOT NULL,   -- as uploaded by the candidate
    mime_type           VARCHAR(100) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    storage_bucket      VARCHAR(150) NOT NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_resumes_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT uq_resumes_generated_filename UNIQUE (generated_filename),
    -- BRD Rule: "Resume <= 5MB"
    CONSTRAINT ck_resumes_size_limit CHECK (size_bytes > 0 AND size_bytes <= 5 * 1024 * 1024),
    -- BRD Rule: "PDF/DOC/DOCX only"
    CONSTRAINT ck_resumes_mime_type CHECK (
        mime_type IN (
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    )
);

CREATE INDEX ix_resumes_candidate_id ON resumes (candidate_id);

-- ============================================================================
-- APPLICATIONS  (links a candidate to a job requisition via a resume)
-- ============================================================================

CREATE TABLE applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL,
    job_id          UUID NOT NULL,
    resume_id       UUID NOT NULL,
    status          application_status NOT NULL DEFAULT 'New',
    consent         BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by_admin_id UUID,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_applications_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_applications_job
        FOREIGN KEY (job_id) REFERENCES job_requisitions (id) ON DELETE CASCADE,
    CONSTRAINT fk_applications_resume
        FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_reviewer
        FOREIGN KEY (reviewed_by_admin_id) REFERENCES admins (id) ON DELETE SET NULL,
    -- BRD Rule: "Resume required" -> enforced by NOT NULL resume_id above
    -- A candidate may only apply once per requisition
    CONSTRAINT uq_applications_candidate_job UNIQUE (candidate_id, job_id)
);

CREATE INDEX ix_applications_candidate_id ON applications (candidate_id);
CREATE INDEX ix_applications_job_id ON applications (job_id);
CREATE INDEX ix_applications_status ON applications (status);
-- Supports the admin paginated grid filtered by job/status, newest first
CREATE INDEX ix_applications_job_status_applied_at ON applications (job_id, status, applied_at DESC);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event           notification_event NOT NULL,
    channel         notification_channel NOT NULL,
    status          notification_status NOT NULL DEFAULT 'pending',

    -- Recipient is exactly one of these, per the BRD event/recipient matrix:
    --   application_submitted     -> admin_recipient_id
    --   submission_confirmation   -> candidate_recipient_id
    --   status_change             -> candidate_recipient_id
    admin_recipient_id      UUID,
    candidate_recipient_id  UUID,

    application_id  UUID,               -- context the notification relates to
    subject         VARCHAR(255),
    payload         JSONB NOT NULL DEFAULT '{}'::JSONB,
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_notifications_admin
        FOREIGN KEY (admin_recipient_id) REFERENCES admins (id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_candidate
        FOREIGN KEY (candidate_recipient_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_application
        FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE,
    CONSTRAINT ck_notifications_exactly_one_recipient CHECK (
        (admin_recipient_id IS NOT NULL)::INT + (candidate_recipient_id IS NOT NULL)::INT = 1
    )
);

CREATE INDEX ix_notifications_admin_recipient ON notifications (admin_recipient_id) WHERE admin_recipient_id IS NOT NULL;
CREATE INDEX ix_notifications_candidate_recipient ON notifications (candidate_recipient_id) WHERE candidate_recipient_id IS NOT NULL;
CREATE INDEX ix_notifications_status ON notifications (status);
CREATE INDEX ix_notifications_application_id ON notifications (application_id);

-- ============================================================================
-- updated_at auto-touch trigger (applied to every table with updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_education_updated_at BEFORE UPDATE ON education
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_experience_updated_at BEFORE UPDATE ON experience
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_job_requisitions_updated_at BEFORE UPDATE ON job_requisitions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
