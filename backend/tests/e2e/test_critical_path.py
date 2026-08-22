"""
End-to-end tests for the full candidate + admin journeys described in the
BRD (Candidate_Sourcing_BRD_Compact_AI_Contract.docx) and the project
contract's "Critical path" testing requirement:

    Browse -> Login -> Apply -> Upload Resume -> Submit -> Admin Review -> Status Update

Unlike the integration suite (which tests one router/feature at a time),
these tests drive a single client through the *whole* flow in one test,
asserting on state as it changes step to step -- this is what catches
bugs that only show up when features are chained together (e.g. a
candidate created via /register not being usable by /applications, or a
job that's Closed still being appliable-to).

Each test class maps to one BRD flow diagram.
"""
import io

from app.common.enums import ApplicationStatus, JobStatus

AUTH = "/api/v1/auth"
JOBS = "/api/v1/jobs"
CANDIDATE = "/api/v1/candidate"
APPLICATIONS = "/api/v1/applications"
REQUISITIONS = "/api/v1/admin/requisitions"
ADMIN_APPLICATIONS = "/api/v1/admin/applications"


def _register_candidate(client, email="e2e-candidate@example.com", password="Password123"):
    resp = client.post(
        f"{AUTH}/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Priya",
            "last_name": "Sharma",
            "mobile": "+919876500000",
            "location": "Pune",
            "consent": True,
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["data"]["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return resp.json()["data"]


class TestCandidateApplicationCriticalPath:
    """Public Jobs -> Job Detail -> Apply -> Login/Register -> Bio -> Education
    -> Experience -> Resume Upload -> Review -> Consent -> Submit -> Confirmation
    (BRD candidate application flow, exact order)."""

    def test_full_journey_anonymous_to_submitted_application(self, client, admin_client, db, make_job):
        admin, admin_user, _ = admin_client
        job = make_job(created_by_admin_id=None, status=JobStatus.PUBLISHED)

        # 1. Browse public jobs -- anonymous, no auth header required.
        listing = client.get(JOBS, params={"page": 1, "page_size": 10})
        assert listing.status_code == 200
        assert any(j["id"] == str(job.id) for j in listing.json()["data"])

        # 2. View job detail -- anonymous.
        detail = client.get(f"{JOBS}/{job.id}")
        assert detail.status_code == 200
        assert detail.json()["data"]["title"] == job.title

        # 3. Apply -- requires auth, so anonymous progress check should 401.
        anon_progress = client.get(f"{APPLICATIONS}/{job.id}/progress")
        assert anon_progress.status_code == 401

        # 4. Register (BRD: "return to intended job" after login/register).
        _register_candidate(client, email="journey@example.com")

        # 5. Bio is captured at registration; confirm profile reflects it.
        profile = client.get(f"{CANDIDATE}/profile")
        assert profile.status_code == 200
        assert profile.json()["data"]["first_name"] == "Priya"

        # 6. Education (repeatable, at least one entry required to submit).
        edu = client.post(
            f"{CANDIDATE}/education",
            json={"institution": "Pune University", "degree": "B.E. Computer Science", "passing_year": 2023, "cgpa": "8.20"},
        )
        assert edu.status_code == 200

        # 7. Experience -- mark fresher since this candidate has no prior job.
        fresher = client.put(f"{CANDIDATE}/experience/fresher-status", json={"is_fresher": True})
        assert fresher.status_code == 200

        # 8. Resume upload -- required, PDF/DOC/DOCX only, <=5MB.
        resume = client.post(
            f"{APPLICATIONS}/{job.id}/resume",
            files={"file": ("priya_resume.pdf", io.BytesIO(b"%PDF-1.4 resume bytes"), "application/pdf")},
        )
        assert resume.status_code == 200
        assert resume.json()["data"]["scan_status"] == "clean"

        # 9. Review -- progress endpoint reflects everything filled in.
        progress = client.get(f"{APPLICATIONS}/{job.id}/progress")
        assert progress.status_code == 200
        progress_data = progress.json()["data"]
        assert progress_data["resume"] is not None
        assert progress_data["already_applied"] is False

        # 10. Submit with consent.
        submit = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert submit.status_code == 200, submit.text
        application_id = submit.json()["data"]["id"]
        assert submit.json()["data"]["status"] == ApplicationStatus.NEW.value

        # 11. Confirmation -- candidate can see it under "my applications".
        mine = client.get(f"{APPLICATIONS}/mine")
        assert mine.status_code == 200
        assert any(a["id"] == application_id for a in mine.json()["data"])

        # ---- Admin Flow continues on the SAME application ----
        # Login -> Dashboard -> Applications Grid -> View Candidate -> Update Status
        dashboard = admin.get("/api/v1/admin/dashboard/stats")
        assert dashboard.status_code == 200

        grid = admin.get(ADMIN_APPLICATIONS, params={"job_id": str(job.id)})
        assert grid.status_code == 200
        assert any(a["id"] == application_id for a in grid.json()["data"])

        candidate_view = admin.get(f"{ADMIN_APPLICATIONS}/{application_id}")
        assert candidate_view.status_code == 200
        assert candidate_view.json()["data"]["candidate"]["first_name"] == "Priya"

        resume_link = admin.get(f"{ADMIN_APPLICATIONS}/{application_id}/resume")
        assert resume_link.status_code == 200
        assert "signed.example" in resume_link.json()["data"]["download_url"]

        status_update = admin.patch(
            f"{ADMIN_APPLICATIONS}/{application_id}/status", json={"status": ApplicationStatus.SHORTLISTED.value}
        )
        assert status_update.status_code == 200
        assert status_update.json()["data"]["status"] == ApplicationStatus.SHORTLISTED.value

        # Candidate sees the updated status on their side too.
        mine_after = client.get(f"{APPLICATIONS}/mine")
        updated = next(a for a in mine_after.json()["data"] if a["id"] == application_id)
        assert updated["status"] == ApplicationStatus.SHORTLISTED.value

    def test_cannot_apply_to_a_closed_job(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job(status=JobStatus.CLOSED)
        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert resp.status_code in (400, 404)

    def test_cannot_submit_without_consent(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        client.put(f"{CANDIDATE}/experience/fresher-status", json={"is_fresher": True})
        client.post(
            f"{CANDIDATE}/education",
            json={"institution": "X", "degree": "B.Sc", "passing_year": 2020, "cgpa": "7.0"},
        )
        client.post(
            f"{APPLICATIONS}/{job.id}/resume",
            files={"file": ("r.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        )
        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": False})
        assert resp.status_code == 400

    def test_duplicate_application_to_same_job_is_rejected(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        client.put(f"{CANDIDATE}/experience/fresher-status", json={"is_fresher": True})
        client.post(
            f"{CANDIDATE}/education",
            json={"institution": "X", "degree": "B.Sc", "passing_year": 2020, "cgpa": "7.0"},
        )
        client.post(
            f"{APPLICATIONS}/{job.id}/resume",
            files={"file": ("r.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        )
        first = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert first.status_code == 200
        second = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert second.status_code == 400


class TestAdminRequisitionCriticalPath:
    """Login -> Dashboard -> Create Requisition -> Draft -> Publish ->
    Applications Grid -> View Candidate -> Update Status (BRD admin flow)."""

    def test_full_journey_draft_to_published_and_visible_publicly(self, admin_client, client):
        admin, admin_user, _ = admin_client

        # Create as Draft (default) -- not visible on the public careers site.
        create = admin.post(
            REQUISITIONS,
            json={
                "title": "Senior Data Engineer",
                "department": "Engineering",
                "location": "Hyderabad",
                "employment_type": "Full-Time",
                "experience_required": "5-8 years",
                "openings": 1,
                "hiring_manager": "Ravi Kumar",
                "max_salary": "3200000.00",
                "hiring_completion_date": "2027-01-31",
                "description": "Own the data platform.",
                "requirements": "Python, Spark, SQL",
            },
        )
        assert create.status_code == 200, create.text
        job_id = create.json()["data"]["id"]
        assert create.json()["data"]["status"] == JobStatus.DRAFT.value

        public_before_publish = client.get(JOBS)
        assert not any(j["id"] == job_id for j in public_before_publish.json()["data"])

        # Publish.
        publish = admin.post(f"{REQUISITIONS}/{job_id}/publish")
        assert publish.status_code == 200
        assert publish.json()["data"]["status"] == JobStatus.PUBLISHED.value

        public_after_publish = client.get(JOBS)
        assert any(j["id"] == job_id for j in public_after_publish.json()["data"])

        # Close.
        close = admin.post(f"{REQUISITIONS}/{job_id}/close")
        assert close.status_code == 200
        assert close.json()["data"]["status"] == JobStatus.CLOSED.value

        public_after_close = client.get(JOBS)
        assert not any(j["id"] == job_id for j in public_after_close.json()["data"])

    def test_candidate_cannot_access_admin_requisition_routes(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.get(REQUISITIONS)
        assert resp.status_code == 403

    def test_anonymous_cannot_access_admin_requisition_routes(self, client):
        resp = client.get(REQUISITIONS)
        assert resp.status_code == 401
