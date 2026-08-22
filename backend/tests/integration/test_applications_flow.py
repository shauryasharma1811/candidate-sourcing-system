"""
Integration tests for the multi-step candidate application flow
(app/api/v1/routes/applications.py + candidate.py) and the admin review
side (list/detail/status update/export/resume download).
"""
import io

from app.common.enums import ApplicationStatus

APPLICATIONS = "/api/v1/applications"
ADMIN_APPLICATIONS = "/api/v1/admin/applications"
CANDIDATE = "/api/v1/candidate"


def _complete_profile(client, mark_fresher: bool = True):
    """Fills in enough of the candidate's profile (bio is already set by
    the make_candidate factory) to pass _validate_submission: at least one
    education entry, and either fresher status or an experience entry."""
    client.post(
        f"{CANDIDATE}/education",
        json={"institution": "IIT Delhi", "degree": "B.Tech CSE", "passing_year": 2022, "cgpa": "8.50"},
    )
    if mark_fresher:
        client.put(f"{CANDIDATE}/experience/fresher-status", json={"is_fresher": True})
    else:
        client.post(
            f"{CANDIDATE}/experience",
            json={
                "company": "Acme Corp",
                "title": "Software Engineer",
                "start_date": "2022-07-01",
                "currently_working": True,
                "responsibilities": "Built things.",
            },
        )


def _upload_resume(client, job_id, filename="resume.pdf", content=b"%PDF-1.4 fake resume content"):
    return client.post(
        f"{APPLICATIONS}/{job_id}/resume",
        files={"file": (filename, io.BytesIO(content), "application/pdf")},
    )


class TestApplicationProgress:
    def test_progress_reflects_job_and_profile_state(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        resp = client.get(f"{APPLICATIONS}/{job.id}/progress")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["job"]["id"] == str(job.id)
        assert data["already_applied"] is False
        assert data["resume"] is None


class TestResumeUpload:
    def test_upload_valid_resume_succeeds(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        resp = _upload_resume(client, job.id)
        assert resp.status_code == 200
        assert resp.json()["data"]["original_name"] == "resume.pdf"
        assert resp.json()["data"]["scan_status"] == "clean"

    def test_upload_rejects_disallowed_extension(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        resp = _upload_resume(client, job.id, filename="resume.exe", content=b"binary")
        assert resp.status_code == 400

    def test_upload_rejects_oversized_file(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        too_big = b"x" * (6 * 1024 * 1024)  # over the 5MB test-config limit
        resp = _upload_resume(client, job.id, content=too_big)
        assert resp.status_code == 400

    def test_upload_rejects_empty_file(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        resp = _upload_resume(client, job.id, content=b"")
        assert resp.status_code == 400

    def test_upload_rejects_eicar_test_signature_as_infected(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        eicar = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
        resp = _upload_resume(client, job.id, content=eicar)
        assert resp.status_code == 422

    def test_delete_resume_removes_it(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        _upload_resume(client, job.id)
        resp = client.delete(f"{APPLICATIONS}/{job.id}/resume")
        assert resp.status_code == 200

        progress = client.get(f"{APPLICATIONS}/{job.id}/progress")
        assert progress.json()["data"]["resume"] is None

    def test_resume_upload_requires_a_published_job(self, candidate_client, make_job):
        from app.common.enums import JobStatus

        client, _, _ = candidate_client
        job = make_job(status=JobStatus.DRAFT)
        resp = _upload_resume(client, job.id)
        assert resp.status_code == 404


class TestSubmitApplication:
    def test_submit_fails_without_education(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        _upload_resume(client, job.id)
        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert resp.status_code == 400

    def test_submit_fails_without_resume(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        _complete_profile(client)
        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert resp.status_code == 400

    def test_submit_fails_without_consent(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        _complete_profile(client)
        _upload_resume(client, job.id)
        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": False})
        assert resp.status_code == 422

    def test_full_happy_path_submits_successfully(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        _complete_profile(client)
        _upload_resume(client, job.id)

        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True, "cover_note": "Excited to apply!"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "New"
        assert data["application_code"].startswith("APP-")

    def test_duplicate_submission_is_rejected(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        _complete_profile(client)
        _upload_resume(client, job.id)
        client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})

        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert resp.status_code == 409

    def test_non_fresher_without_experience_entry_is_rejected(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        client.post(
            f"{CANDIDATE}/education",
            json={"institution": "IIT Delhi", "degree": "B.Tech", "passing_year": 2022, "cgpa": "8.00"},
        )
        # deliberately skip marking fresher AND skip adding experience
        _upload_resume(client, job.id)
        resp = client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})
        assert resp.status_code == 400

    def test_list_mine_shows_submitted_application(self, candidate_client, make_job):
        client, _, _ = candidate_client
        job = make_job()
        _complete_profile(client)
        _upload_resume(client, job.id)
        client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True})

        resp = client.get(f"{APPLICATIONS}/mine")
        assert resp.status_code == 200
        job_ids = [a["job_id"] for a in resp.json()["data"]]
        assert str(job.id) in job_ids


def _submit_full_application(client, job):
    _complete_profile(client)
    _upload_resume(client, job.id)
    return client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True}).json()["data"]


class TestAdminApplicationsReview:
    def test_admin_can_list_applications(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        _submit_full_application(cand_client, job)

        resp = admin.get(ADMIN_APPLICATIONS)
        assert resp.status_code == 200
        assert resp.json()["meta"]["total"] >= 1

    def test_admin_can_filter_by_status(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        _submit_full_application(cand_client, job)

        resp = admin.get(ADMIN_APPLICATIONS, params={"status": "Shortlisted"})
        assert resp.json()["meta"]["total"] == 0

        resp = admin.get(ADMIN_APPLICATIONS, params={"status": "New"})
        assert resp.json()["meta"]["total"] >= 1

    def test_admin_can_search_by_candidate_name(self, candidate_client, admin_client, make_job):
        cand_client, cand_user, candidate = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        _submit_full_application(cand_client, job)

        resp = admin.get(ADMIN_APPLICATIONS, params={"search": candidate.first_name})
        assert resp.json()["meta"]["total"] >= 1

    def test_candidate_cannot_access_admin_applications(self, candidate_client, make_job):
        client, _, _ = candidate_client
        resp = client.get(ADMIN_APPLICATIONS)
        assert resp.status_code == 403

    def test_get_application_detail(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        submitted = _submit_full_application(cand_client, job)

        resp = admin.get(f"{ADMIN_APPLICATIONS}/{submitted['id']}")
        assert resp.status_code == 200
        assert resp.json()["data"]["job"]["id"] == str(job.id)

    def test_update_status_transitions_correctly(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        submitted = _submit_full_application(cand_client, job)

        resp = admin.patch(f"{ADMIN_APPLICATIONS}/{submitted['id']}/status", json={"status": "Shortlisted"})
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "Shortlisted"

    def test_download_resume_returns_a_signed_link(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        submitted = _submit_full_application(cand_client, job)

        resp = admin.get(f"{ADMIN_APPLICATIONS}/{submitted['id']}/resume")
        assert resp.status_code == 200
        assert resp.json()["data"]["url"].startswith("https://signed.example/")

    def test_export_csv_returns_a_csv_file(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        _submit_full_application(cand_client, job)

        resp = admin.get(f"{ADMIN_APPLICATIONS}/export")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        assert "attachment" in resp.headers["content-disposition"]
