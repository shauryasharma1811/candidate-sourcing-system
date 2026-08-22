"""Integration tests for /api/v1/jobs (public, unauthenticated)."""
from app.common.enums import JobStatus

BASE = "/api/v1/jobs"


class TestListPublishedJobs:
    def test_only_published_jobs_are_listed(self, client, make_job):
        make_job(title="Published Role", status=JobStatus.PUBLISHED)
        make_job(title="Draft Role", status=JobStatus.DRAFT)
        make_job(title="Closed Role", status=JobStatus.CLOSED)

        resp = client.get(BASE)
        assert resp.status_code == 200
        titles = [j["title"] for j in resp.json()["data"]]
        assert "Published Role" in titles
        assert "Draft Role" not in titles
        assert "Closed Role" not in titles

    def test_search_by_title(self, client, make_job):
        make_job(title="Senior Backend Engineer")
        make_job(title="Product Designer")

        resp = client.get(BASE, params={"q": "Backend"})
        titles = [j["title"] for j in resp.json()["data"]]
        assert "Senior Backend Engineer" in titles
        assert "Product Designer" not in titles

    def test_filter_by_department_and_location(self, client, make_job):
        make_job(title="Eng Role", department="Engineering", location="Bengaluru")
        make_job(title="Sales Role", department="Sales", location="Mumbai")

        resp = client.get(BASE, params={"department": "Engineering"})
        titles = [j["title"] for j in resp.json()["data"]]
        assert titles == ["Eng Role"]

        resp = client.get(BASE, params={"location": "Mumbai"})
        titles = [j["title"] for j in resp.json()["data"]]
        assert titles == ["Sales Role"]

    def test_pagination_meta(self, client, make_job):
        for i in range(3):
            make_job(title=f"Job {i}")

        resp = client.get(BASE, params={"page": 1, "page_size": 2})
        body = resp.json()
        assert len(body["data"]) == 2
        assert body["meta"]["total"] == 3
        assert body["meta"]["total_pages"] == 2

    def test_page_size_over_the_max_is_rejected(self, client, make_job):
        make_job()
        resp = client.get(BASE, params={"page_size": 500})
        assert resp.status_code == 422


class TestJobDetail:
    def test_get_published_job_detail(self, client, make_job):
        job = make_job(title="Detail Me")
        resp = client.get(f"{BASE}/{job.id}")
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Detail Me"

    def test_draft_job_is_not_publicly_visible(self, client, make_job):
        job = make_job(title="Hidden Draft", status=JobStatus.DRAFT)
        resp = client.get(f"{BASE}/{job.id}")
        assert resp.status_code == 404

    def test_unknown_job_id_is_404(self, client):
        resp = client.get(f"{BASE}/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_malformed_job_id_does_not_500(self, client):
        resp = client.get(f"{BASE}/not-a-uuid")
        assert resp.status_code in (400, 404, 422)


class TestJobFilters:
    def test_filters_reflect_published_jobs(self, client, make_job):
        make_job(department="Engineering", location="Bengaluru")
        resp = client.get(f"{BASE}/filters")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "Engineering" in data.get("departments", data.get("department", []))
