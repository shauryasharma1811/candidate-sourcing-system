# Test Traceability Matrix

Maps each BRD / project-contract acceptance criterion to the automated
test(s) that cover it, across all four layers of the suite:

| Layer | Location | Runs against |
|---|---|---|
| Unit | `backend/tests/unit/` | nothing external — pure functions |
| API / Integration | `backend/tests/integration/` | FastAPI `TestClient` + real Postgres |
| API / E2E (critical path) | `backend/tests/e2e/` | same, but chains multiple routers per test |
| UI (browser) | `frontend/tests/ui/` | real Next.js app + real backend, via Playwright |

Run everything: `backend/` → `pytest -q --cov=app`, `frontend/` → `npm run test:e2e`.

## Authentication

| Acceptance criterion (BRD / contract) | Test(s) |
|---|---|
| Candidate can register with email, password, bio fields, consent | `integration/test_auth.py::TestRegister`, `e2e/test_critical_path.py::test_full_journey_anonymous_to_submitted_application`, `ui/auth.spec.ts` "registering with valid details" |
| Email must be unique | `integration/test_auth.py`, `ui/auth.spec.ts` "duplicate email is rejected" |
| Password policy (strength) enforced server-side | `unit/test_schema_validators.py`, `ui/auth.spec.ts` "weak password is rejected" |
| Passwords hashed with bcrypt, never stored/logged in plaintext | `unit/test_security.py` |
| Login issues 15-minute access token + 7-day refresh token | `unit/test_jwt.py`, `integration/test_auth.py` |
| Wrong password / unknown email return the same generic error (no enumeration) | `integration/test_auth.py::test_login_error_message_does_not_leak_which_field_is_wrong` (existing), `ui/auth.spec.ts` "wrong password" / "unknown email" |
| Disabled account cannot log in | `integration/test_auth.py::test_disabled_account_cannot_log_in` |
| Refresh token rotates/renews the access token | `integration/test_auth.py` refresh tests |
| Forgot password issues a SHA-256 single-use reset token | `integration/test_auth.py` |
| Admin login is a separate endpoint; candidate credentials rejected there | `e2e/test_critical_path.py::test_anonymous_cannot_access_admin_requisition_routes`, `ui/admin.spec.ts` "candidate credentials are rejected on the admin login page" |
| After login/registration, candidate returns to the job they were applying to | `ui/auth.spec.ts` "logging in after being redirected returns the candidate to the job they wanted" |
| Anonymous/unauthenticated requests to protected routes get 401 | `integration/test_*`, `e2e/test_critical_path.py`, `ui/auth.spec.ts` "visiting the apply page while logged out" |

## Public Careers Site

| Acceptance criterion | Test(s) |
|---|---|
| Only Published jobs appear publicly | `integration/test_jobs_public.py`, `e2e/test_critical_path.py::test_full_journey_draft_to_published_and_visible_publicly` |
| Search matches job titles (debounced, `ilike`) | `integration/test_jobs_public.py`, `ui/jobs-browse.spec.ts` "search updates the URL" |
| Filters (department/location/experience/employment type) | `integration/test_jobs_public.py` |
| Pagination | `integration/test_jobs_public.py` |
| Filtered/searched view is a shareable link (URL reflects state) | `ui/jobs-browse.spec.ts` "search updates the URL", "reloading a filtered URL" |
| Job detail page shows full requisition | `integration/test_jobs_public.py`, `ui/jobs-browse.spec.ts` "shows the job's key requisition fields" |
| No-match search shows empty state, not an error | `ui/jobs-browse.spec.ts` "no matches shows an empty state" |
| Closed jobs are not appliable-to | `e2e/test_critical_path.py::test_cannot_apply_to_a_closed_job` |

## Candidate Application Flow (multi-step)

| Acceptance criterion | Test(s) |
|---|---|
| Full flow: Apply → Bio → Education → Experience → Resume → Review → Consent → Submit → Confirmation | `e2e/test_critical_path.py::test_full_journey_anonymous_to_submitted_application`, `ui/apply-flow.spec.ts` "a candidate can complete every step" |
| Education is repeatable, at least one entry required to submit | `integration/test_candidate_profile.py`, `integration/test_applications_flow.py` |
| Experience: fresher toggle OR at least one experience entry required | `integration/test_candidate_profile.py`, `integration/test_applications_flow.py` |
| Education passing year cannot be in the future | `unit/test_schema_validators.py` |
| Experience end date ≥ start date | `unit/test_schema_validators.py` |
| Resume required before submit | `integration/test_applications_flow.py` |
| Resume ≤ 5MB | `integration/test_applications_flow.py::test_upload_rejects_oversized_file`, `unit/test_virus_scan_service.py` |
| Resume must be PDF/DOC/DOCX only | `integration/test_applications_flow.py::test_upload_rejects_disallowed_extension`, `ui/apply-flow.spec.ts` "uploading a disallowed file type" |
| Resume storage path never exposed to client (signed URL only) | `integration/test_applications_flow.py` admin resume-download tests, `e2e/test_critical_path.py` |
| Submit requires consent | `e2e/test_critical_path.py::test_cannot_submit_without_consent`, `ui/apply-flow.spec.ts` "submit is blocked until consent" |
| Duplicate application to the same job is rejected | `e2e/test_critical_path.py::test_duplicate_application_to_same_job_is_rejected` |
| In-progress application state is recoverable (progress endpoint) | `integration/test_applications_flow.py::TestApplicationProgress`, `ui/apply-flow.spec.ts` "resuming an in-progress application" |
| Mobile number format validation | `unit/test_schema_validators.py` |
| Name fields ≤ 50 chars | `unit/test_schema_validators.py` |

## Admin — Requisition Management

| Acceptance criterion | Test(s) |
|---|---|
| Requisition CRUD (title, dept, location, type, experience, openings, hiring manager, max salary, completion date) | `integration/test_requisitions_admin.py` |
| Created as Draft by default | `integration/test_requisitions_admin.py`, `e2e/test_critical_path.py::test_full_journey_draft_to_published_and_visible_publicly`, `ui/admin.spec.ts` "creating a requisition saves it as Draft" |
| Publish makes it publicly visible; Close removes it | `e2e/test_critical_path.py::test_full_journey_draft_to_published_and_visible_publicly` |
| Duplicate requisition gets a new unique requisition code | `integration/test_requisitions_admin.py` |
| Only Admin role can access requisition management routes | `e2e/test_critical_path.py::test_candidate_cannot_access_admin_requisition_routes`, `::test_anonymous_cannot_access_admin_requisition_routes` |
| Required fields enforced on the create form | `ui/admin.spec.ts` "required requisition fields block submission when empty" |

## Admin — Application Review

| Acceptance criterion | Test(s) |
|---|---|
| Paginated applications grid, filterable by job/status/search | `integration/test_applications_flow.py` |
| View full candidate detail per application | `e2e/test_critical_path.py` (candidate_view assertion) |
| Update application status (New → Reviewed → Shortlisted / Rejected) | `integration/test_applications_flow.py`, `e2e/test_critical_path.py`, `ui/admin.spec.ts` "applications grid shows candidates and supports status updates" |
| Candidate status change reflects candidate-side ("my applications") | `e2e/test_critical_path.py::test_full_journey_anonymous_to_submitted_application` (final assertion) |
| Resume download via short-lived signed URL | `integration/test_applications_flow.py`, `e2e/test_critical_path.py` |
| Export applications to CSV/Excel | `integration/test_applications_flow.py` |

## Notifications

| Acceptance criterion | Test(s) |
|---|---|
| Admin notified on application submission | `integration/test_notifications.py` |
| Candidate notified on submission and status change | `integration/test_notifications.py` |
| Unread count endpoint | `integration/test_notifications.py` |

## API Response Contract

| Acceptance criterion | Test(s) |
|---|---|
| Every success response is `{success, message, data, meta}` | asserted implicitly via `.json()["data"]`/`["message"]` across all integration/e2e tests |
| Every error response is `{success: false, message, errors[]}` | `unit/test_schema_validators.py`, error-path assertions across `integration/` |

## Security & Non-functional

| Acceptance criterion | Test(s) |
|---|---|
| Passwords/tokens never appear in logs or responses | `unit/test_security.py` |
| Role-based access control enforced at the API (not just hidden in UI) | `e2e/test_critical_path.py` 401/403 tests |
| Rate limiting on auth endpoints | *(not yet covered — see Known Gaps below)* |

## Known Gaps

- Rate limiting on `/auth/login` and `/auth/forgot-password` has no
  automated test yet (requires a way to fast-forward or mock the limiter's
  clock without slowing down the whole suite).
- CI wiring for the Playwright suite (`frontend/tests/ui/`) needs
  `SEEDED_ADMIN_EMAIL` / `SEEDED_ADMIN_PASSWORD` / `SEEDED_ADMIN_TOKEN`
  env vars pointing at a seeded admin account (admin registration is
  intentionally not exposed via the public API — see `AUTH.md`). Tests
  that need an admin fixture `test.skip()` themselves when these aren't
  set, so the suite stays green locally without a full stack running.
- Email delivery itself (SMTP) is not asserted end-to-end — notification
  tests check that the *event* fires, not that an email lands in an inbox.
