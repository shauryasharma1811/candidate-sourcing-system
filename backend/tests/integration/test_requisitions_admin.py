"""Integration tests for /api/v1/admin/requisitions (admin-only CRUD)."""
from app.common.enums import JobStatus

BASE = "/api/v1/admin/requisitions"


def _requisition_payload(**overrides):
    payload = dict(
        title="Platform Engineer",
        department="Engineering",
        location="Remote",
        employment_type="Full-Time",
        experience_required="3-5 years",
        openings=1,
        hiring_manager="Priya Shah",
        description="Own the platform.",
        max_salary=2200000,
        hiring_completion_date=None,
        publish=False,
    )
    payload.update(overrides)
    return payload


class TestAccessControl:
    def test_requisitions_are_not_accessible_without_auth(self, client):
        resp = client.get(BASE)
        assert resp.status_code == 401

    def test_candidate_cannot_access_admin_requisitions(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.get(BASE)
        assert resp.status_code == 403

    def test_candidate_cannot_create_requisition(self, candidate_client):
        client, _, _ = candidate_client
        resp = client.post(BASE, json=_requisition_payload())
        assert resp.status_code == 403


class TestCreateRequisition:
    def test_create_defaults_to_draft(self, admin_client):
        client, _, _ = admin_client
        resp = client.post(BASE, json=_requisition_payload())
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "Draft"

    def test_create_with_publish_true_publishes_immediately(self, admin_client):
        client, _, _ = admin_client
        resp = client.post(BASE, json=_requisition_payload(publish=True))
        assert resp.json()["data"]["status"] == "Published"

    def test_create_generates_a_unique_requisition_code(self, admin_client):
        client, _, _ = admin_client
        first = client.post(BASE, json=_requisition_payload(title="A"))
        second = client.post(BASE, json=_requisition_payload(title="B"))
        assert first.json()["data"]["requisition_code"] != second.json()["data"]["requisition_code"]

    def test_create_rejects_zero_openings(self, admin_client):
        client, _, _ = admin_client
        resp = client.post(BASE, json=_requisition_payload(openings=0))
        assert resp.status_code == 422

    def test_create_rejects_missing_required_fields(self, admin_client):
        client, _, _ = admin_client
        resp = client.post(BASE, json={"title": "Incomplete"})
        assert resp.status_code == 422


class TestReadRequisitions:
    def test_list_admin_sees_all_statuses(self, admin_client, make_job):
        client, _, admin = admin_client
        make_job(title="Draft One", status=JobStatus.DRAFT, created_by_admin_id=admin.id)
        make_job(title="Published One", status=JobStatus.PUBLISHED, created_by_admin_id=admin.id)
        make_job(title="Closed One", status=JobStatus.CLOSED, created_by_admin_id=admin.id)

        resp = client.get(BASE)
        titles = {j["title"] for j in resp.json()["data"]}
        assert {"Draft One", "Published One", "Closed One"} <= titles

    def test_list_filters_by_status(self, admin_client, make_job):
        client, _, admin = admin_client
        make_job(title="Draft Only", status=JobStatus.DRAFT, created_by_admin_id=admin.id)
        make_job(title="Published Only", status=JobStatus.PUBLISHED, created_by_admin_id=admin.id)

        resp = client.get(BASE, params={"status": "Draft"})
        titles = [j["title"] for j in resp.json()["data"]]
        assert titles == ["Draft Only"]

    def test_get_detail_includes_description(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(description="Full detail text", created_by_admin_id=admin.id)
        resp = client.get(f"{BASE}/{job.id}")
        assert resp.status_code == 200
        assert resp.json()["data"]["description"] == "Full detail text"

    def test_get_unknown_requisition_is_404(self, admin_client):
        client, _, _ = admin_client
        resp = client.get(f"{BASE}/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestUpdateRequisition:
    def test_update_changes_fields(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(title="Old Title", status=JobStatus.DRAFT, created_by_admin_id=admin.id)
        resp = client.put(f"{BASE}/{job.id}", json=_requisition_payload(title="New Title"))
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "New Title"

    def test_update_with_publish_true_publishes_a_draft(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(status=JobStatus.DRAFT, created_by_admin_id=admin.id)
        resp = client.put(f"{BASE}/{job.id}", json=_requisition_payload(publish=True))
        assert resp.json()["data"]["status"] == "Published"

    def test_closed_requisition_cannot_be_edited(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(status=JobStatus.CLOSED, created_by_admin_id=admin.id)
        resp = client.put(f"{BASE}/{job.id}", json=_requisition_payload())
        assert resp.status_code == 400


class TestPublishCloseDuplicate:
    def test_publish_moves_draft_to_published(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(status=JobStatus.DRAFT, created_by_admin_id=admin.id)
        resp = client.post(f"{BASE}/{job.id}/publish")
        assert resp.json()["data"]["status"] == "Published"

    def test_publish_already_published_requisition_fails(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(status=JobStatus.PUBLISHED, created_by_admin_id=admin.id)
        resp = client.post(f"{BASE}/{job.id}/publish")
        assert resp.status_code == 400

    def test_close_moves_published_to_closed(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(status=JobStatus.PUBLISHED, created_by_admin_id=admin.id)
        resp = client.post(f"{BASE}/{job.id}/close")
        assert resp.json()["data"]["status"] == "Closed"

    def test_close_a_draft_fails(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(status=JobStatus.DRAFT, created_by_admin_id=admin.id)
        resp = client.post(f"{BASE}/{job.id}/close")
        assert resp.status_code == 400

    def test_duplicate_creates_a_new_draft_with_new_code(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(title="Original", status=JobStatus.PUBLISHED, created_by_admin_id=admin.id)
        resp = client.post(f"{BASE}/{job.id}/duplicate")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "Draft"
        assert data["requisition_code"] != job.requisition_code
        assert "Original" in data["title"]


class TestDeleteRequisition:
    def test_delete_removes_the_requisition(self, admin_client, make_job):
        client, _, admin = admin_client
        job = make_job(status=JobStatus.DRAFT, created_by_admin_id=admin.id)
        resp = client.delete(f"{BASE}/{job.id}")
        assert resp.status_code == 200

        follow_up = client.get(f"{BASE}/{job.id}")
        assert follow_up.status_code == 404
