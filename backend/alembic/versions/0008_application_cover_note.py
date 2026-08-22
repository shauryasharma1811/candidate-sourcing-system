"""applications.cover_note — optional cover note captured at Resume Upload (Step 4) per BRD

Revision ID: 0008_application_cover_note
Revises: 0007_application_code
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_cover_note"
down_revision = "0007_app_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("cover_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "cover_note")
