"""allow future education passing year

Revision ID: b9eb772580e7
Revises: 0009_resume_ret
Create Date: 2026-08-22 20:06:07.321793
"""
from alembic import op
import sqlalchemy as sa


revision = 'b9eb772580e7'
down_revision = '0009_resume_ret'
branch_labels = None
depends_on = None



def upgrade():
    op.drop_constraint(
        "ck_education_passing_year_not_future",
        "education",
        type_="check",
    )

    op.create_check_constraint(
        "ck_education_passing_year_future_10",
        "education",
        "passing_year >= 1950 AND passing_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 10",
    )


def downgrade():
    op.drop_constraint(
        "ck_education_passing_year_future_10",
        "education",
        type_="check",
    )

    op.create_check_constraint(
        "ck_education_passing_year_not_future",
        "education",
        "passing_year >= 1950 AND passing_year <= EXTRACT(YEAR FROM CURRENT_DATE)",
    )