# Backend Test Suite

129+ tests, ~91% statement coverage (contract target: ≥80%).

- `tests/unit/` — pure logic, no DB, no HTTP: JWT/password hashing,
  virus-scan signature detection, Pydantic validation rules.
- `tests/integration/` — full request/response cycle through FastAPI's
  `TestClient` against a real Postgres database: auth, public jobs,
  admin requisition CRUD, the candidate profile (bio/education/experience),
  the full apply flow (resume upload incl. virus/size/type checks,
  submission validation, duplicate prevention), admin application review
  and status updates, and notifications.
- `tests/e2e/test_critical_path.py` — chains features together in a single
  test, the way the BRD's flow diagrams describe them end-to-end
  (Browse → Login → Apply → Upload Resume → Submit → Admin Review → Status
  Update, and Login → Dashboard → Create Requisition → Draft → Publish →
  Applications Grid → View Candidate → Update Status). Where the
  integration suite proves each router works in isolation, this suite
  proves the *handoffs* between them work — e.g. that a job only becomes
  publicly visible after `/publish`, and disappears again after `/close`.

See `docs/TEST_TRACEABILITY.md` (repo root) for a mapping from each BRD
acceptance-criteria row to the automated test(s) that cover it.

For browser-level UI tests (forms, client-side validation, the multi-step
apply wizard, admin screens) see `frontend/tests/ui/` — run with
`npm run test:e2e` from `frontend/`.

## Why Postgres and not SQLite

The models use Postgres-specific types (`UUID`, native `ENUM`s), so an
in-memory SQLite DB can't run this schema faithfully. Tests run against a
real Postgres instance instead.

## Running locally

```bash
# 1. Start Postgres and create the test database (once)
createdb candidate_sourcing_test

# 2. Point the app at it — either export these or copy them into .env
export DATABASE_URL=postgresql+psycopg2://<user>:<password>@localhost:5432/candidate_sourcing_test
export JWT_SECRET_KEY=test_secret_key_for_ci_only
export S3_ENDPOINT_URL=http://localhost:9999   # never actually called — see below
export S3_ACCESS_KEY=test
export S3_SECRET_KEY=test
export S3_BUCKET_NAME=test-bucket
export S3_REGION=us-east-1
export MAX_UPLOAD_SIZE_MB=5
export ALLOWED_UPLOAD_EXTENSIONS=.pdf,.doc,.docx
export SMTP_HOST=localhost SMTP_PORT=587 SMTP_USER=test SMTP_PASSWORD=test SMTP_FROM_EMAIL=no-reply@test.local

# 3. Install deps and run
pip install -r requirements.txt pytest-cov
pytest -q --cov=app --cov-report=term-missing
```

## Fixtures (`tests/conftest.py`)

- `db` — one Postgres connection per test, wrapped in an outer
  transaction + SAVEPOINT that's rolled back at teardown. Nothing a test
  writes (or commits) leaks into the next test.
- `client` / `candidate_client` / `admin_client` — a `TestClient` wired
  to that same `db` session via `app.dependency_overrides[get_db]`.
  `candidate_client`/`admin_client` are **separate** `TestClient`
  instances (not just different headers on one client) so a test can
  hold a logged-in candidate and a logged-in admin at the same time
  without one's auth header clobbering the other's.
- `make_candidate` / `make_admin` / `make_job` — factories for the rows
  most tests need as setup, with sensible defaults you can override.
- `_no_real_s3` (autouse) — every test's `.env` points `S3_ENDPOINT_URL`
  at an address nothing is listening on, so any *real* call would hang
  retrying. This fixture monkeypatches `storage_service`'s upload /
  delete / presigned-URL functions to no-ops before the app (and its
  startup event) is even constructed.

## A bug this suite caught

`auth_service.py` checks `user.is_active` on every login and refresh,
but the SQLAlchemy `User` model never declared that column — even
though it's present in `sql/schema.sql` and the Alembic migration. Every
login would have raised `AttributeError`. Fixed in `app/models/user.py`;
`test_disabled_account_cannot_log_in` now guards against a regression.
