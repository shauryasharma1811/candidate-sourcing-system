"""candidate is_fresher flag; experience.description -> responsibilities

Revision ID: 0006_experience_fresher_responsibilities
Revises: 0005_education_passing_year_cgpa
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_experience_fresher_responsibilities"
down_revision = "0005_education_passing_year_cgpa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "candidates", sa.Column("is_fresher", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.alter_column("experience", "description", new_column_name="responsibilities")


def downgrade() -> None:
    op.alter_column("experience", "responsibilities", new_column_name="description")
    op.drop_column("candidates", "is_fresher")
