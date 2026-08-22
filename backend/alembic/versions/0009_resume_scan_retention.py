"""resumes — virus-scan fields + retention policy fields

Adds:
  - scan_status (enum: pending/clean/infected/failed), scanned_at, scan_provider
  - retention_expires_at, purged_at

Existing rows predate the scanner: backfilled to CLEAN/placeholder (they've
already been served for review without incident) rather than PENDING, so
they don't suddenly get blocked from download. retention_expires_at is
backfilled from uploaded_at + settings.RESUME_RETENTION_DAYS.

Revision ID: 0009_resume_scan_retention
Revises: 0008_application_cover_note
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_resume_ret"
down_revision = "0008_cover_note"
branch_labels = None
depends_on = None

# create_type=False (see 0001 for rationale): enum.create() below is the sole DDL emitter.
RESUME_SCAN_STATUS_ENUM = sa.Enum(
    "pending", "clean", "infected", "failed", name="resume_scan_status", create_type=False
)


def upgrade() -> None:
    RESUME_SCAN_STATUS_ENUM.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "resumes",
        sa.Column("scan_status", RESUME_SCAN_STATUS_ENUM, nullable=False, server_default="pending"),
    )
    op.add_column("resumes", sa.Column("scanned_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("resumes", sa.Column("scan_provider", sa.String(length=50), nullable=True))
    op.add_column("resumes", sa.Column("retention_expires_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("resumes", sa.Column("purged_at", sa.TIMESTAMP(timezone=True), nullable=True))

    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE resumes SET scan_status = 'clean', scanned_at = uploaded_at, "
            "scan_provider = 'backfill', "
            "retention_expires_at = uploaded_at + (:days || ' days')::interval"
        ),
        {"days": 365},
    )

    # Drop the server_default now that existing rows are backfilled — new
    # rows always set scan_status explicitly at upload time.
    op.alter_column("resumes", "scan_status", server_default=None)


def downgrade() -> None:
    op.drop_column("resumes", "purged_at")
    op.drop_column("resumes", "retention_expires_at")
    op.drop_column("resumes", "scan_provider")
    op.drop_column("resumes", "scanned_at")
    op.drop_column("resumes", "scan_status")
    RESUME_SCAN_STATUS_ENUM.drop(op.get_bind(), checkfirst=True)
