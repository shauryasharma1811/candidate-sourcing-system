"""applications.application_code — human-readable Application ID (APP-<year>-<seq>)

Revision ID: 0007_application_code
Revises: 0006_experience_fresher_responsibilities
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_application_code"
down_revision = "0006_experience_fresher_responsibilities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable first so any pre-existing rows (unlikely this early, but the
    # migration must still be safe to run against a populated table) don't
    # break the ADD COLUMN. Backfilled immediately below, then locked down.
    op.add_column("applications", sa.Column("application_code", sa.String(length=20), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, applied_at FROM applications ORDER BY applied_at ASC, id ASC")
    ).fetchall()
    seq_by_year: dict[int, int] = {}
    for row in rows:
        year = row.applied_at.year
        seq_by_year[year] = seq_by_year.get(year, 0) + 1
        code = f"APP-{year}-{seq_by_year[year]:05d}"
        conn.execute(
            sa.text("UPDATE applications SET application_code = :code WHERE id = :id"),
            {"code": code, "id": row.id},
        )

    op.alter_column("applications", "application_code", nullable=False)
    op.create_unique_constraint("uq_applications_application_code", "applications", ["application_code"])
    op.create_index("ix_applications_application_code", "applications", ["application_code"])


def downgrade() -> None:
    op.drop_index("ix_applications_application_code", table_name="applications")
    op.drop_constraint("uq_applications_application_code", "applications", type_="unique")
    op.drop_column("applications", "application_code")
