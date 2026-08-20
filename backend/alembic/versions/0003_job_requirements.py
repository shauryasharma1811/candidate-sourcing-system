"""add requirements column to job_requisitions

Requirements is a distinct free-text field from Description — the public
job-detail wireframe renders them as separate sections ("What you'll do"
vs "What we're looking for"), so they need to be editable independently
by admins rather than concatenated into one blob.

Revision ID: 0003_job_requirements
Revises: 0002_password_reset_tokens
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_job_requirements"
down_revision = "0002_password_reset_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_requisitions", sa.Column("requirements", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("job_requisitions", "requirements")
