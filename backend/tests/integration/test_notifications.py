"""
Integration tests for /api/v1/admin/notifications. Notifications are a
side effect of the application flow (Application Submitted -> every
admin), so these tests drive a candidate through submission first.
"""
import io

NOTIFICATIONS = "/api/v1/admin/notifications"
APPLICATIONS = "/api/v1/applications"
CANDIDATE = "/api/v1/candidate"


def _submit_application(client, job):
    client.post(
        f"{CANDIDATE}/education",
        json={"institution": "IIT Delhi", "degree": "B.Tech CSE", "passing_year": 2022, "cgpa": "8.50"},
    )
    client.put(f"{CANDIDATE}/experience/fresher-status", json={"is_fresher": True})
    client.post(
        f"{APPLICATIONS}/{job.id}/resume",
        files={"file": ("resume.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
    )
    return client.post(f"{APPLICATIONS}/{job.id}/submit", json={"consent": True}).json()["data"]


class TestAdminNotifications:
    def test_submitting_an_application_notifies_the_admin(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        _submit_application(cand_client, job)

        resp = admin.get(NOTIFICATIONS)
        assert resp.status_code == 200
        assert resp.json()["meta"]["total"] >= 1

    def test_unread_count_increases_after_submission(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()

        before = admin.get(f"{NOTIFICATIONS}/unread-count").json()["data"]["unread_count"]
        _submit_application(cand_client, job)
        after = admin.get(f"{NOTIFICATIONS}/unread-count").json()["data"]["unread_count"]
        assert after == before + 1

    def test_marking_a_notification_read_decrements_unread_count(self, candidate_client, admin_client, make_job):
        cand_client, _, _ = candidate_client
        admin, _, _ = admin_client
        job = make_job()
        _submit_application(cand_client, job)

        notification_id = admin.get(NOTIFICATIONS).json()["data"][0]["id"]
        before = admin.get(f"{NOTIFICATIONS}/unread-count").json()["data"]["unread_count"]

        resp = admin.patch(f"{NOTIFICATIONS}/{notification_id}/read")
        assert resp.status_code == 200

        after = admin.get(f"{NOTIFICATIONS}/unread-count").json()["data"]["unread_count"]
        assert after == before - 1

    def test_notifications_require_admin_role(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.get(NOTIFICATIONS)
        assert resp.status_code == 403

    def test_notifications_are_paginated(self, admin_client):
        client, _, _ = admin_client
        resp = client.get(NOTIFICATIONS, params={"page": 1, "page_size": 5})
        assert resp.status_code == 200
        assert resp.json()["meta"]["page"] == 1
        assert resp.json()["meta"]["page_size"] == 5
