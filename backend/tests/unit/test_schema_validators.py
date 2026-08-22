"""
Unit tests for the pure-validation rules living in the Pydantic schemas —
no DB, no HTTP. These are the backend-authoritative rules the contract
calls out explicitly (name length, mobile format, date sanity, etc.).
"""
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.auth import CandidateRegisterRequest
from app.schemas.candidate import EducationInput, ExperienceInput
from app.schemas.requisition import RequisitionCreateRequest


def _valid_register_kwargs(**overrides):
    kwargs = dict(
        email="a@example.com",
        password="Password123",
        first_name="Ann",
        last_name="Lee",
        mobile="+919876543210",
    )
    kwargs.update(overrides)
    return kwargs


class TestCandidateRegisterRequest:
    def test_accepts_valid_payload(self):
        req = CandidateRegisterRequest(**_valid_register_kwargs())
        assert req.email == "a@example.com"

    def test_rejects_name_over_50_chars(self):
        with pytest.raises(ValidationError):
            CandidateRegisterRequest(**_valid_register_kwargs(first_name="a" * 51))

    def test_accepts_name_at_exactly_50_chars(self):
        req = CandidateRegisterRequest(**_valid_register_kwargs(first_name="a" * 50))
        assert len(req.first_name) == 50

    @pytest.mark.parametrize("mobile", ["12345", "abcdefghij", "+1-234-567", ""])
    def test_rejects_invalid_mobile_formats(self, mobile):
        with pytest.raises(ValidationError):
            CandidateRegisterRequest(**_valid_register_kwargs(mobile=mobile))

    @pytest.mark.parametrize("mobile", ["+919876543210", "9876543210", "+11234567"])
    def test_accepts_valid_mobile_formats(self, mobile):
        req = CandidateRegisterRequest(**_valid_register_kwargs(mobile=mobile))
        assert req.mobile == mobile


class TestEducationInput:
    def test_rejects_passing_year_in_the_future(self):
        with pytest.raises(ValidationError):
            EducationInput(institution="X", degree="Y", passing_year=9999, cgpa=Decimal("8.0"))

    def test_rejects_cgpa_above_10(self):
        with pytest.raises(ValidationError):
            EducationInput(institution="X", degree="Y", passing_year=2020, cgpa=Decimal("10.5"))

    def test_accepts_boundary_cgpa_values(self):
        EducationInput(institution="X", degree="Y", passing_year=2020, cgpa=Decimal("0.00"))
        EducationInput(institution="X", degree="Y", passing_year=2020, cgpa=Decimal("10.00"))


class TestExperienceInput:
    def test_end_date_before_start_date_is_rejected(self):
        with pytest.raises(ValidationError):
            ExperienceInput(company="A", title="B", start_date="2023-01-01", end_date="2022-01-01")

    def test_currently_working_true_forbids_end_date(self):
        with pytest.raises(ValidationError):
            ExperienceInput(company="A", title="B", start_date="2023-01-01", currently_working=True, end_date="2023-06-01")

    def test_currently_working_false_requires_end_date(self):
        with pytest.raises(ValidationError):
            ExperienceInput(company="A", title="B", start_date="2023-01-01", currently_working=False)

    def test_valid_completed_role_is_accepted(self):
        exp = ExperienceInput(company="A", title="B", start_date="2020-01-01", end_date="2022-01-01")
        assert exp.end_date.isoformat() == "2022-01-01"

    def test_valid_current_role_is_accepted(self):
        exp = ExperienceInput(company="A", title="B", start_date="2023-01-01", currently_working=True)
        assert exp.end_date is None


class TestRequisitionCreateRequest:
    def test_rejects_openings_below_one(self):
        with pytest.raises(ValidationError):
            RequisitionCreateRequest(
                title="T", department="D", location="L", employment_type="Full-Time",
                openings=0, hiring_manager="M",
            )

    def test_rejects_hiring_completion_date_in_the_past(self):
        with pytest.raises(ValidationError):
            RequisitionCreateRequest(
                title="T", department="D", location="L", employment_type="Full-Time",
                openings=1, hiring_manager="M", hiring_completion_date="2000-01-01",
            )

    def test_strips_whitespace_from_text_fields(self):
        req = RequisitionCreateRequest(
            title="  Title  ", department="D", location="L", employment_type="Full-Time",
            openings=1, hiring_manager="M",
        )
        assert req.title == "Title"
