"""init schema — users, admins, candidates, education, experience,
job_requisitions, resumes, applications, notifications

Revision ID: 0001_init_schema
Revises:
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_init_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # NOTE (C-1 fix): each enum is created manually below via enum.create(checkfirst=True).
    # If the same Enum objects were then handed to op.create_table(...) with their default
    # create_type=True, SQLAlchemy's DDL-compiler emits its OWN "CREATE TYPE" for that column
    # (it does not know the type was already created), which does not use checkfirst and
    # collides with the type created here -> "DuplicateObject: type ... already exists".
    # create_type=False tells SQLAlchemy "this type already exists in the DB, don't emit DDL
    # for it when creating tables that use it" - the table-level CREATE TYPE event is skipped
    # entirely and only the explicit enum.create() calls below issue CREATE TYPE.
    user_role = postgresql.ENUM("Admin", "Candidate", name="user_role", create_type=False)
    job_status = postgresql.ENUM("Draft", "Published", "Closed", name="job_status", create_type=False)
    employment_type = postgresql.ENUM(
        "Full-Time", "Part-Time", "Contract", "Internship", name="employment_type", create_type=False
    )
    application_status = postgresql.ENUM(
        "New", "Reviewed", "Shortlisted", "Rejected", name="application_status", create_type=False
    )
    notification_event = postgresql.ENUM(
        "application_submitted", "submission_confirmation", "status_change",
        name="notification_event", create_type=False,
    )
    notification_channel = postgresql.ENUM("email", "in_app", name="notification_channel", create_type=False)
    notification_status = postgresql.ENUM(
        "pending", "sent", "failed", "read", name="notification_status", create_type=False
    )

    bind = op.get_bind()
    for enum in (
        user_role, job_status, employment_type, application_status,
        notification_event, notification_channel, notification_status,
    ):
        enum.create(bind, checkfirst=True)

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint(r"email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'", name="ck_users_email_format"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])

    # --- admins ---
    op.create_table(
        "admins",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name", sa.String(50), nullable=False),
        sa.Column("last_name", sa.String(50), nullable=False),
        sa.Column("department", sa.String(100)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_admins_user", ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_admins_user_id"),
    )
    op.create_index("ix_admins_user_id", "admins", ["user_id"])

    # --- candidates ---
    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name", sa.String(50), nullable=False),
        sa.Column("last_name", sa.String(50), nullable=False),
        sa.Column("mobile", sa.String(20), nullable=False),
        sa.Column("location", sa.Text()),
        sa.Column("consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_candidates_user", ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_candidates_user_id"),
        sa.CheckConstraint("char_length(first_name) <= 50 AND char_length(last_name) <= 50", name="ck_candidates_name_length"),
        sa.CheckConstraint(r"mobile ~ '^\+?[0-9]{7,15}$'", name="ck_candidates_mobile_format"),
    )
    op.create_index("ix_candidates_user_id", "candidates", ["user_id"])
    op.create_index("ix_candidates_name", "candidates", ["last_name", "first_name"])

    # --- education ---
    op.create_table(
        "education",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("institution", sa.String(150), nullable=False),
        sa.Column("degree", sa.String(150), nullable=False),
        sa.Column("field_of_study", sa.String(150)),
        sa.Column("start_year", sa.SmallInteger(), nullable=False),
        sa.Column("end_year", sa.SmallInteger()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], name="fk_education_candidate", ondelete="CASCADE"),
        sa.CheckConstraint("start_year <= EXTRACT(YEAR FROM now())::SMALLINT", name="ck_education_start_not_future"),
        sa.CheckConstraint("end_year IS NULL OR end_year <= EXTRACT(YEAR FROM now())::SMALLINT", name="ck_education_end_not_future"),
        sa.CheckConstraint("end_year IS NULL OR end_year >= start_year", name="ck_education_end_after_start"),
    )
    op.create_index("ix_education_candidate_id", "education", ["candidate_id"])

    # --- experience ---
    op.create_table(
        "experience",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company", sa.String(150), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date()),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], name="fk_experience_candidate", ondelete="CASCADE"),
        sa.CheckConstraint("end_date IS NULL OR end_date >= start_date", name="ck_experience_end_after_start"),
    )
    op.create_index("ix_experience_candidate_id", "experience", ["candidate_id"])

    # --- job_requisitions ---
    op.create_table(
        "job_requisitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("requisition_code", sa.String(50), nullable=False),
        sa.Column("department", sa.String(100), nullable=False),
        sa.Column("location", sa.String(150), nullable=False),
        sa.Column("employment_type", employment_type, nullable=False),
        sa.Column("experience_required", sa.String(50)),
        sa.Column("openings", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("hiring_manager", sa.String(150), nullable=False),
        sa.Column("max_salary", sa.Numeric(12, 2)),
        sa.Column("hiring_completion_date", sa.Date()),
        sa.Column("description", sa.Text()),
        sa.Column("status", job_status, nullable=False, server_default="Draft"),
        sa.Column("created_by_admin_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_admin_id"], ["admins.id"], name="fk_job_requisitions_admin", ondelete="SET NULL"),
        sa.UniqueConstraint("requisition_code", name="uq_job_requisitions_code"),
        sa.CheckConstraint("openings > 0", name="ck_job_requisitions_openings_positive"),
        sa.CheckConstraint("max_salary IS NULL OR max_salary >= 0", name="ck_job_requisitions_salary_positive"),
    )
    op.create_index("ix_job_requisitions_status", "job_requisitions", ["status"])
    op.create_index("ix_job_requisitions_department", "job_requisitions", ["department"])
    op.create_index("ix_job_requisitions_location", "job_requisitions", ["location"])
    op.create_index("ix_job_requisitions_status_created_at", "job_requisitions", ["status", sa.text("created_at DESC")])
    op.execute(
        "CREATE INDEX ix_job_requisitions_title_trgm ON job_requisitions "
        "USING gin (to_tsvector('english', title))"
    )

    # --- resumes ---
    op.create_table(
        "resumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("generated_filename", sa.String(255), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_bucket", sa.String(150), nullable=False),
        sa.Column("uploaded_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], name="fk_resumes_candidate", ondelete="CASCADE"),
        sa.UniqueConstraint("generated_filename", name="uq_resumes_generated_filename"),
        sa.CheckConstraint("size_bytes > 0 AND size_bytes <= 5 * 1024 * 1024", name="ck_resumes_size_limit"),
        sa.CheckConstraint(
            "mime_type IN ('application/pdf', 'application/msword', "
            "'application/vnd.openxmlformats-officedocument.wordprocessingml.document')",
            name="ck_resumes_mime_type",
        ),
    )
    op.create_index("ix_resumes_candidate_id", "resumes", ["candidate_id"])

    # --- applications ---
    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resume_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", application_status, nullable=False, server_default="New"),
        sa.Column("consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("applied_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_by_admin_id", postgresql.UUID(as_uuid=True)),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], name="fk_applications_candidate", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["job_requisitions.id"], name="fk_applications_job", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], name="fk_applications_resume", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by_admin_id"], ["admins.id"], name="fk_applications_reviewer", ondelete="SET NULL"),
        sa.UniqueConstraint("candidate_id", "job_id", name="uq_applications_candidate_job"),
    )
    op.create_index("ix_applications_candidate_id", "applications", ["candidate_id"])
    op.create_index("ix_applications_job_id", "applications", ["job_id"])
    op.create_index("ix_applications_status", "applications", ["status"])
    op.create_index(
        "ix_applications_job_status_applied_at", "applications",
        ["job_id", "status", sa.text("applied_at DESC")],
    )

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("event", notification_event, nullable=False),
        sa.Column("channel", notification_channel, nullable=False),
        sa.Column("status", notification_status, nullable=False, server_default="pending"),
        sa.Column("admin_recipient_id", postgresql.UUID(as_uuid=True)),
        sa.Column("candidate_recipient_id", postgresql.UUID(as_uuid=True)),
        sa.Column("application_id", postgresql.UUID(as_uuid=True)),
        sa.Column("subject", sa.String(255)),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("read_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["admin_recipient_id"], ["admins.id"], name="fk_notifications_admin", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["candidate_recipient_id"], ["candidates.id"], name="fk_notifications_candidate", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], name="fk_notifications_application", ondelete="CASCADE"),
        sa.CheckConstraint(
            "(admin_recipient_id IS NOT NULL)::INT + (candidate_recipient_id IS NOT NULL)::INT = 1",
            name="ck_notifications_exactly_one_recipient",
        ),
    )
    op.create_index(
        "ix_notifications_admin_recipient", "notifications", ["admin_recipient_id"],
        postgresql_where=sa.text("admin_recipient_id IS NOT NULL"),
    )
    op.create_index(
        "ix_notifications_candidate_recipient", "notifications", ["candidate_recipient_id"],
        postgresql_where=sa.text("candidate_recipient_id IS NOT NULL"),
    )
    op.create_index("ix_notifications_status", "notifications", ["status"])
    op.create_index("ix_notifications_application_id", "notifications", ["application_id"])

    # --- updated_at trigger function + triggers ---
    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for table in ("users", "admins", "candidates", "education", "experience", "job_requisitions", "applications"):
        op.execute(
            f"CREATE TRIGGER trg_{table}_updated_at BEFORE UPDATE ON {table} "
            f"FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        )


def downgrade() -> None:
    for table in ("users", "admins", "candidates", "education", "experience", "job_requisitions", "applications"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table}")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")

    op.drop_table("notifications")
    op.drop_table("applications")
    op.drop_table("resumes")
    op.drop_table("job_requisitions")
    op.drop_table("experience")
    op.drop_table("education")
    op.drop_table("candidates")
    op.drop_table("admins")
    op.drop_table("users")

    for enum_name in (
        "notification_status", "notification_channel", "notification_event",
        "application_status", "employment_type", "job_status", "user_role",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
