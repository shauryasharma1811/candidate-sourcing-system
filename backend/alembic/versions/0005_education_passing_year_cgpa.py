"""education fields — replace field_of_study/start_year/end_year with
passing_year and cgpa, matching the BRD's repeatable education record

Revision ID: 0005_education_passing_year_cgpa
Revises: 0004_candidate_bio_fields
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_education_passing_year_cgpa"
down_revision = "0004_candidate_bio_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_education_start_not_future", "education", type_="check")
    op.drop_constraint("ck_education_end_not_future", "education", type_="check")
    op.drop_constraint("ck_education_end_after_start", "education", type_="check")

    op.add_column("education", sa.Column("passing_year", sa.SmallInteger(), nullable=True))
    op.execute("UPDATE education SET passing_year = COALESCE(end_year, start_year)")
    op.alter_column("education", "passing_year", nullable=False)

    op.add_column("education", sa.Column("cgpa", sa.Numeric(4, 2), nullable=True))
    op.execute("UPDATE education SET cgpa = 0")
    op.alter_column("education", "cgpa", nullable=False)

    op.drop_column("education", "field_of_study")
    op.drop_column("education", "start_year")
    op.drop_column("education", "end_year")

    op.create_check_constraint(
        "ck_education_passing_year_not_future",
        "education",
        "passing_year <= EXTRACT(YEAR FROM now())::SMALLINT",
    )
    op.create_check_constraint(
        "ck_education_passing_year_reasonable",
        "education",
        "passing_year >= 1950",
    )
    op.create_check_constraint(
        "ck_education_cgpa_range",
        "education",
        "cgpa >= 0 AND cgpa <= 10",
    )


def downgrade() -> None:
    op.drop_constraint("ck_education_cgpa_range", "education", type_="check")
    op.drop_constraint("ck_education_passing_year_reasonable", "education", type_="check")
    op.drop_constraint("ck_education_passing_year_not_future", "education", type_="check")

    op.add_column("education", sa.Column("field_of_study", sa.String(150), nullable=True))
    op.add_column("education", sa.Column("start_year", sa.SmallInteger(), nullable=True))
    op.add_column("education", sa.Column("end_year", sa.SmallInteger(), nullable=True))
    op.execute("UPDATE education SET start_year = passing_year, end_year = passing_year")
    op.alter_column("education", "start_year", nullable=False)

    op.drop_column("education", "cgpa")
    op.drop_column("education", "passing_year")

    op.create_check_constraint(
        "ck_education_start_not_future", "education", "start_year <= EXTRACT(YEAR FROM now())::SMALLINT"
    )
    op.create_check_constraint(
        "ck_education_end_not_future", "education", "end_year IS NULL OR end_year <= EXTRACT(YEAR FROM now())::SMALLINT"
    )
    op.create_check_constraint(
        "ck_education_end_after_start", "education", "end_year IS NULL OR end_year >= start_year"
    )
