"""Integration tests for /api/v1/candidate/* (bio, education, experience)."""
import io

BASE = "/api/v1/candidate"


class TestAccessControl:
    def test_profile_requires_authentication(self, client):
        resp = client.get(f"{BASE}/profile")
        assert resp.status_code == 403

    def test_admin_cannot_access_candidate_profile_endpoints(self, admin_client):
        client, _, _ = admin_client
        resp = client.get(f"{BASE}/profile")
        assert resp.status_code == 403


class TestBioData:
    def test_get_bio_returns_registration_data(self, candidate_client):
        client, user, candidate = candidate_client
        resp = client.get(f"{BASE}/profile")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == user.email
        assert data["first_name"] == candidate.first_name

    def test_update_bio_persists_changes(self, candidate_client):
        client, _, _ = candidate_client
        payload = {
            "first_name": "Updated",
            "last_name": "Name",
            "mobile": "+919876500000",
            "location": "Chennai",
            "current_company": "Acme",
            "notice_period": "30 Days",
        }
        resp = client.put(f"{BASE}/profile", json=payload)
        assert resp.status_code == 200
        assert resp.json()["data"]["first_name"] == "Updated"
        assert resp.json()["data"]["location"] == "Chennai"

        follow_up = client.get(f"{BASE}/profile")
        assert follow_up.json()["data"]["first_name"] == "Updated"

    def test_update_bio_rejects_invalid_mobile(self, candidate_client):
        client, _, _ = candidate_client
        payload = {"first_name": "A", "last_name": "B", "mobile": "not-a-number", "location": "Pune"}
        resp = client.put(f"{BASE}/profile", json=payload)
        assert resp.status_code == 422

    def test_update_bio_rejects_name_over_50_chars(self, candidate_client):
        client, _, _ = candidate_client
        payload = {"first_name": "x" * 51, "last_name": "B", "mobile": "+919876543210", "location": "Pune"}
        resp = client.put(f"{BASE}/profile", json=payload)
        assert resp.status_code == 422


class TestProfilePhoto:
    def test_upload_valid_photo_succeeds(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.post(
            f"{BASE}/profile/photo",
            files={"file": ("photo.jpg", io.BytesIO(b"\xff\xd8\xff fake jpeg bytes"), "image/jpeg")},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["photo"]["mime_type"] == "image/jpeg"

    def test_upload_rejects_non_image_mime_type(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.post(
            f"{BASE}/profile/photo",
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        )
        assert resp.status_code == 400

    def test_upload_rejects_oversized_photo(self, candidate_client):
        client, _, _ = candidate_client
        too_big = b"x" * (6 * 1024 * 1024)
        resp = client.post(
            f"{BASE}/profile/photo",
            files={"file": ("photo.jpg", io.BytesIO(too_big), "image/jpeg")},
        )
        assert resp.status_code == 400


class TestEducation:
    def _payload(self, **overrides):
        payload = {"institution": "IIT Bombay", "degree": "B.Tech CSE", "passing_year": 2021, "cgpa": "8.75"}
        payload.update(overrides)
        return payload

    def test_add_and_list_education(self, candidate_client):
        client, _, _ = candidate_client
        add_resp = client.post(f"{BASE}/education", json=self._payload())
        assert add_resp.status_code == 200

        list_resp = client.get(f"{BASE}/education")
        institutions = [e["institution"] for e in list_resp.json()["data"]]
        assert "IIT Bombay" in institutions

    def test_add_education_rejects_future_passing_year(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.post(f"{BASE}/education", json=self._payload(passing_year=2099))
        assert resp.status_code == 422

    def test_update_education(self, candidate_client):
        client, _, _ = candidate_client
        created = client.post(f"{BASE}/education", json=self._payload()).json()["data"]
        edu_id = created["id"] if isinstance(created, dict) else created[0]["id"]

        resp = client.put(f"{BASE}/education/{edu_id}", json=self._payload(institution="Updated Institute"))
        assert resp.status_code == 200
        assert resp.json()["data"]["institution"] == "Updated Institute"

    def test_delete_education(self, candidate_client):
        client, _, _ = candidate_client
        created = client.post(f"{BASE}/education", json=self._payload()).json()["data"]
        edu_id = created["id"] if isinstance(created, dict) else created[0]["id"]

        resp = client.delete(f"{BASE}/education/{edu_id}")
        assert resp.status_code == 200

        remaining = [e["id"] for e in client.get(f"{BASE}/education").json()["data"]]
        assert edu_id not in remaining

    def test_cannot_update_someone_elses_education(self, candidate_client, make_candidate, client):
        first_client, _, _ = candidate_client
        created = first_client.post(f"{BASE}/education", json=self._payload()).json()["data"]
        edu_id = created["id"] if isinstance(created, dict) else created[0]["id"]

        # a second, unrelated candidate tries to edit the first candidate's record
        other_user, _ = make_candidate(email="other-candidate@example.com")
        from tests.conftest import auth_headers

        client.headers.update(auth_headers(other_user))
        resp = client.put(f"{BASE}/education/{edu_id}", json=self._payload(institution="Hijacked"))
        assert resp.status_code == 404


class TestExperience:
    def test_fresher_status_defaults_and_can_be_set(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.put(f"{BASE}/experience/fresher-status", json={"is_fresher": True})
        assert resp.status_code == 200
        assert resp.json()["data"]["is_fresher"] is True

        follow_up = client.get(f"{BASE}/experience/fresher-status")
        assert follow_up.json()["data"]["is_fresher"] is True

    def test_add_and_list_experience(self, candidate_client):
        client, _, _ = candidate_client
        payload = {
            "company": "Globex",
            "title": "Backend Developer",
            "start_date": "2021-06-01",
            "end_date": "2023-01-01",
            "currently_working": False,
            "responsibilities": "Built APIs.",
        }
        add_resp = client.post(f"{BASE}/experience", json=payload)
        assert add_resp.status_code == 200

        list_resp = client.get(f"{BASE}/experience")
        companies = [e["company"] for e in list_resp.json()["data"]]
        assert "Globex" in companies

    def test_add_experience_rejects_end_before_start(self, candidate_client):
        client, _, _ = candidate_client
        payload = {
            "company": "Globex",
            "title": "Dev",
            "start_date": "2023-01-01",
            "end_date": "2021-01-01",
            "currently_working": False,
        }
        resp = client.post(f"{BASE}/experience", json=payload)
        assert resp.status_code == 422

    def test_delete_experience(self, candidate_client):
        client, _, _ = candidate_client
        payload = {
            "company": "Initech",
            "title": "Dev",
            "start_date": "2020-01-01",
            "currently_working": True,
        }
        created = client.post(f"{BASE}/experience", json=payload).json()["data"]
        exp_id = created["id"] if isinstance(created, dict) else created[0]["id"]

        resp = client.delete(f"{BASE}/experience/{exp_id}")
        assert resp.status_code == 200
        remaining = [e["id"] for e in client.get(f"{BASE}/experience").json()["data"]]
        assert exp_id not in remaining
