# Resume Storage

## Overview

| Feature | Backend |
|---|---|
| Upload | `POST /applications/{jobId}/resume` (candidate) |
| Delete | `DELETE /applications/{jobId}/resume` (candidate) |
| Secure download | `GET /admin/applications/{applicationId}/resume` (admin) |
| Manual retention purge | `POST /admin/storage/purge-expired` (admin) |

## Dependency guidance

**`app/services/storage_service.py` is the only module allowed to import
`boto3`.** Every other module — services, routes, the retention job — goes
through its functions (`upload_resume`, `delete_resume`,
`get_presigned_download_url`, `ensure_bucket_lifecycle_policy`) rather than
touching the S3 client directly. This keeps the S3-compatible backend
swappable (MinIO in dev, AWS S3 or another provider in production) behind
one seam, and keeps every other module's tests free of needing a real or
mocked S3 client.

`virus_scan_service.py` and `retention_service.py` both depend on
`storage_service` for the parts of their job that touch storage — they never
import `boto3` themselves.

## S3-compatible storage

- MinIO locally (`docker-compose.yml`), any S3-compatible endpoint in
  production — `storage_service._client()` is a plain `boto3` S3 client
  pointed at `S3_ENDPOINT_URL`, so nothing else in the app needs to know
  which provider is behind it.
- Storage paths/object keys are **never** exposed to API clients. Every
  response returns metadata (`ResumeMetadata`) or a signed URL
  (`ResumeDownloadLink`) — never the raw `generated_filename` object key.

## Signed URLs & secure downloads

- `get_presigned_download_url()` returns a time-limited signed URL
  (`RESUME_DOWNLOAD_URL_TTL_SECONDS`, default 300s) rather than a permanent
  link or direct proxy — per-request, expiring, and never reusable past
  the window.
- **`Content-Disposition: attachment`** is forced on every signed URL, so a
  resume never opens inline in the browser (closes off a crafted file
  executing as HTML/script in the recruiter's session).
- **`Content-Type` is pinned** to the mime type recorded at upload time,
  not whatever's stored in S3 — closes off MIME-sniffing tricks from a
  renamed file extension.
- Downloads are gated on scan status: `get_resume_download_url()` returns
  `403` for anything that isn't `ScanStatus.CLEAN`. An infected file never
  reaches storage in the first place (rejected at upload), but this also
  covers a `PENDING` verdict — the state a real async scanner would leave
  a file in between upload and result.

## Virus scan (placeholder)

`app/services/virus_scan_service.py` runs synchronously on every upload,
**before** the file reaches S3 or the database. Today it's a placeholder:

- Rejects empty files (`FAILED`)
- Flags the standard EICAR antivirus test string (`INFECTED`) — lets the
  reject-on-infected path be exercised with a real (harmless) test file
- Everything else passes (`CLEAN`)

Swapping in a real scanner (ClamAV daemon, a vendor API, S3 Object Lambda)
means replacing the body of `scan()` — every caller only depends on the
`ScanResult` dataclass, so nothing above this module changes.
`settings.VIRUS_SCAN_PROVIDER` and `VIRUS_SCAN_ENABLED` already externalize
which scanner is active as config, not code.

`resumes.scan_status` (`pending` / `clean` / `infected` / `failed`),
`scanned_at`, and `scan_provider` record the verdict per file.

## Retention policy architecture

Two layers enforce the same policy (`RESUME_RETENTION_DAYS`, default 365):

1. **App-level** — `retention_service.purge_expired_resumes()` deletes the
   S3 object (via `storage_service.delete_resume`) and the DB row for every
   resume past `retention_expires_at` that isn't still attached to an
   application. Meant to be invoked by a scheduled job once Sprint 6's
   background-worker infra exists; until then, `POST
   /admin/storage/purge-expired` (optionally `?dry_run=true`) is the manual
   entry point.
2. **Storage-level backstop** — `storage_service.ensure_bucket_lifecycle_policy()`
   applies an S3/MinIO bucket lifecycle rule on the `resumes/` prefix at
   startup, expiring objects independently of whether the app-level job
   ever runs. Best-effort: a backend that doesn't support lifecycle
   configuration logs a warning and the API still starts.

`resumes.retention_expires_at` is computed once at upload time
(`retention_service.compute_retention_expiry`) so the policy can't drift
between rows even if `RESUME_RETENTION_DAYS` changes later.
