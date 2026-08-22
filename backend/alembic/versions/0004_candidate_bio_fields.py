"""candidate bio fields — gender, dob, current company, notice period,
address, profile photo metadata

Revision ID: 0004_candidate_bio_fields
Revises: 0003_job_requirements
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_candidate_bio_fields"
down_revision = "0003_job_requirements"
branch_labels = None
depends_on = None

NOTICE_PERIOD_VALUES = ("Immediate", "15 Days", "30 Days", "60 Days", "90 Days")


def upgrade() -> None:
    # create_type=False (see 0001 for rationale): the enum.create() calls below are the
    # only DDL that should issue CREATE TYPE; op.add_column() must not re-issue it.
    gender_enum = postgresql.ENUM(
        "Male", "Female", "Other", "Prefer not to say", name="gender", create_type=False
    )
    gender_enum.create(op.get_bind(), checkfirst=True)

    notice_period_enum = postgresql.ENUM(*NOTICE_PERIOD_VALUES, name="notice_period", create_type=False)
    notice_period_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("candidates", sa.Column("gender", gender_enum, nullable=True))
    op.add_column("candidates", sa.Column("dob", sa.Date(), nullable=True))
    op.add_column("candidates", sa.Column("current_company", sa.String(150), nullable=True))
    op.add_column("candidates", sa.Column("notice_period", notice_period_enum, nullable=True))
    op.add_column("candidates", sa.Column("address", sa.Text(), nullable=True))

    # Profile photo — metadata only, mirrors resumes' storage-metadata pattern.
    op.add_column("candidates", sa.Column("photo_generated_filename", sa.String(255), nullable=True))
    op.add_column("candidates", sa.Column("photo_original_name", sa.String(255), nullable=True))
    op.add_column("candidates", sa.Column("photo_mime_type", sa.String(100), nullable=True))
    op.add_column("candidates", sa.Column("photo_size_bytes", sa.BigInteger(), nullable=True))

    op.create_check_constraint(
        "ck_candidates_dob_not_future_and_min_age",
        "candidates",
        "dob IS NULL OR (dob <= now()::date - INTERVAL '18 years')",
    )
    op.create_check_constraint(
        "ck_candidates_current_company_length",
        "candidates",
        "current_company IS NULL OR char_length(current_company) <= 150",
    )
    op.create_check_constraint(
        "ck_candidates_address_length",
        "candidates",
        "address IS NULL OR char_length(address) <= 500",
    )


def downgrade() -> None:
    op.drop_constraint("ck_candidates_address_length", "candidates", type_="check")
    op.drop_constraint("ck_candidates_current_company_length", "candidates", type_="check")
    op.drop_constraint("ck_candidates_dob_not_future_and_min_age", "candidates", type_="check")

    op.drop_column("candidates", "photo_size_bytes")
    op.drop_column("candidates", "photo_mime_type")
    op.drop_column("candidates", "photo_original_name")
    op.drop_column("candidates", "photo_generated_filename")
    op.drop_column("candidates", "address")
    op.drop_column("candidates", "notice_period")
    op.drop_column("candidates", "current_company")
    op.drop_column("candidates", "dob")
    op.drop_column("candidates", "gender")

    postgresql.ENUM(name="notice_period").drop(op.get_bind())
    postgresql.ENUM(name="gender").drop(op.get_bind())
