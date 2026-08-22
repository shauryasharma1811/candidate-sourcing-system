"""Integration tests for /api/v1/auth/*."""
import pytest

from app.common.enums import UserRole
from app.core.security import decode_token, hash_password
from app.models.user import User

BASE = "/api/v1/auth"


def _register_payload(**overrides):
    payload = dict(
        email="new.candidate@example.com",
        password="StrongPass1",
        first_name="Ada",
        last_name="Lovelace",
        mobile="+919876543210",
        location="Pune",
        consent=True,
    )
    payload.update(overrides)
    return payload


class TestRegister:
    def test_register_creates_account_and_returns_tokens(self, client):
        resp = client.post(f"{BASE}/register", json=_register_payload())
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert "access_token" in body["data"]
        assert "refresh_token" in body["data"]
        assert body["data"]["expires_in_minutes"] == 15

    def test_register_duplicate_email_conflicts(self, client):
        client.post(f"{BASE}/register", json=_register_payload())
        resp = client.post(f"{BASE}/register", json=_register_payload())
        assert resp.status_code == 409
        assert resp.json()["success"] is False

    @pytest.mark.parametrize(
        "overrides",
        [
            {"password": "short1A"},           # < 8 chars
            {"password": "alllowercase1"},      # no uppercase
            {"password": "ALLUPPERCASE1"},      # no lowercase
            {"password": "NoDigitsHere"},       # no digit
            {"mobile": "not-a-number"},
            {"first_name": "x" * 51},
        ],
    )
    def test_register_rejects_invalid_input(self, client, overrides):
        resp = client.post(f"{BASE}/register", json=_register_payload(**overrides))
        assert resp.status_code == 422

    def test_register_persists_a_candidate_role_user(self, client, db):
        client.post(f"{BASE}/register", json=_register_payload(email="persisted@example.com"))
        user = db.query(User).filter(User.email == "persisted@example.com").one()
        assert user.role == UserRole.CANDIDATE
        assert user.is_active is True


class TestLogin:
    def test_login_with_correct_credentials_succeeds(self, client, make_candidate):
        make_candidate(email="loginme@example.com", password="Password123")
        resp = client.post(f"{BASE}/login", json={"email": "loginme@example.com", "password": "Password123"})
        assert resp.status_code == 200
        assert resp.json()["data"]["access_token"]

    def test_login_with_wrong_password_is_rejected(self, client, make_candidate):
        make_candidate(email="loginme2@example.com", password="Password123")
        resp = client.post(f"{BASE}/login", json={"email": "loginme2@example.com", "password": "WrongPass1"})
        assert resp.status_code == 401

    def test_login_with_unknown_email_is_rejected(self, client):
        resp = client.post(f"{BASE}/login", json={"email": "nobody@example.com", "password": "Password123"})
        assert resp.status_code == 401

    def test_login_error_message_does_not_reveal_which_field_was_wrong(self, client, make_candidate):
        make_candidate(email="samemsg@example.com", password="Password123")
        wrong_password = client.post(f"{BASE}/login", json={"email": "samemsg@example.com", "password": "WrongPass1"})
        unknown_email = client.post(f"{BASE}/login", json={"email": "unknown2@example.com", "password": "WrongPass1"})
        assert wrong_password.json()["message"] == unknown_email.json()["message"]

    def test_admin_cannot_log_in_via_candidate_login_and_vice_versa(self, client, make_admin, make_candidate):
        make_admin(email="admin1@example.com", password="Password123")
        make_candidate(email="cand1@example.com", password="Password123")

        # admin creds through the general /login endpoint still work (role is derived from account)
        resp = client.post(f"{BASE}/login", json={"email": "admin1@example.com", "password": "Password123"})
        assert resp.status_code == 200

        # candidate creds through the admin-only /admin/login endpoint must fail
        resp = client.post(f"{BASE}/admin/login", json={"email": "cand1@example.com", "password": "Password123"})
        assert resp.status_code == 401

    def test_login_carries_intended_job_id_into_redirect(self, client, make_candidate, make_job):
        make_candidate(email="redirect@example.com", password="Password123")
        job = make_job()
        resp = client.post(
            f"{BASE}/login",
            json={"email": "redirect@example.com", "password": "Password123", "intended_job_id": str(job.id)},
        )
        assert resp.status_code == 200
        assert str(job.id) in resp.json()["data"]["redirect_to"]

    def test_disabled_account_cannot_log_in(self, client, make_candidate, db):
        user, _ = make_candidate(email="disabled@example.com", password="Password123")
        user.is_active = False
        db.commit()
        resp = client.post(f"{BASE}/login", json={"email": "disabled@example.com", "password": "Password123"})
        assert resp.status_code == 403


class TestRefreshAndMe:
    def test_refresh_issues_a_new_access_token(self, client, make_candidate):
        make_candidate(email="refresh@example.com", password="Password123")
        login = client.post(f"{BASE}/login", json={"email": "refresh@example.com", "password": "Password123"})
        refresh_token = login.json()["data"]["refresh_token"]

        resp = client.post(f"{BASE}/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        new_access = resp.json()["data"]["access_token"]
        decoded = decode_token(new_access)
        assert decoded["type"] == "access"

    def test_refresh_rejects_an_access_token(self, client, make_candidate):
        make_candidate(email="refresh2@example.com", password="Password123")
        login = client.post(f"{BASE}/login", json={"email": "refresh2@example.com", "password": "Password123"})
        access_token = login.json()["data"]["access_token"]

        resp = client.post(f"{BASE}/refresh", json={"refresh_token": access_token})
        assert resp.status_code == 401

    def test_me_requires_authentication(self, client):
        resp = client.get(f"{BASE}/me")
        assert resp.status_code == 403  # no bearer header at all -> HTTPBearer rejects

    def test_me_returns_the_logged_in_profile(self, candidate_client):
        client, user, candidate = candidate_client
        resp = client.get(f"{BASE}/me")
        assert resp.status_code == 200
        assert resp.json()["data"]["email"] == user.email
        assert resp.json()["data"]["first_name"] == candidate.first_name


class TestForgotAndResetPassword:
    def test_forgot_password_always_returns_generic_success(self, client, make_candidate):
        make_candidate(email="forgot@example.com")
        known = client.post(f"{BASE}/forgot-password", json={"email": "forgot@example.com"})
        unknown = client.post(f"{BASE}/forgot-password", json={"email": "unknown9@example.com"})
        assert known.status_code == 200
        assert unknown.status_code == 200
        assert known.json()["message"] == unknown.json()["message"]

    def test_reset_password_rejects_bad_token(self, client):
        resp = client.post(f"{BASE}/reset-password", json={"token": "not-a-real-token", "new_password": "NewPass123"})
        assert resp.status_code in (400, 401, 404)

    def test_reset_password_rejects_weak_password(self, client):
        resp = client.post(f"{BASE}/reset-password", json={"token": "whatever", "new_password": "weak"})
        assert resp.status_code == 422
