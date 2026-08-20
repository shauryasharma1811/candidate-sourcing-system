# Authentication System

## Overview

| Feature | Backend | Frontend |
|---|---|---|
| Candidate Registration | `POST /auth/register` | `/auth/register` |
| Candidate Login | `POST /auth/login` | `/auth/login` |
| Admin Login | `POST /auth/admin/login` | `/auth/admin/login` |
| Forgot Password | `POST /auth/forgot-password` | `/auth/forgot-password` |
| Reset Password | `POST /auth/reset-password` | `/auth/reset-password` |
| Token Refresh | `POST /auth/refresh` | handled silently by `apiFetch` |
| Current user | `GET /auth/me` | `useAuth()` |

## Backend design

- **`app/core/security.py`** — bcrypt hashing, JWT create/decode. Access tokens
  (15 min) carry `role`; refresh tokens (7 days) do not.
- **`app/services/auth_service.py`** — all business rules: duplicate-email
  rejection, admin-login role check, password-reset token lifecycle,
  enumeration-safe error messages (login and forgot-password never reveal
  whether an email exists).
- **`app/repositories/`** — `UserRepository`, `CandidateRepository`,
  `AdminRepository`, `PasswordResetTokenRepository`. Only these touch the
  DB session, per the locked architecture.
- **`app/auth/deps.py`** — `get_current_user` (validates the bearer token) and
  `require_role(...)` for RBAC on any router.
- **Password reset tokens** are stored **hashed** (`sha256`), single-use
  (`used_at`), and expire after 30 minutes — mirrors how passwords themselves
  are never stored in plaintext.
- **"Return to intended job"**: `LoginRequest.intended_job_id` is accepted by
  `/auth/login`; the service returns `redirect_to: "/jobs/{id}/apply"` in the
  token response so the frontend knows exactly where to send the candidate
  after authenticating.

## Frontend design

- **`lib/session.ts`** — the only module touching `localStorage`/`sessionStorage`.
  Access + refresh tokens persist in `localStorage` (session persistence across
  reloads); the intended job id is kept in `sessionStorage` (cleared once consumed).
- **`lib/api-client.ts`** — every request goes through `apiFetch`. On a 401 it
  transparently calls `/auth/refresh` once and retries the original request —
  the user never sees a forced logout just because their 15-minute access
  token expired mid-session.
- **`features/auth/auth-context.tsx`** — `AuthProvider` wraps the whole app in
  `app/layout.tsx`. On mount it checks for a persisted token and silently
  loads `/auth/me`, so a page refresh keeps the user logged in.
- **`features/auth/protected-route.tsx`** — `<ProtectedRoute allowedRoles={[...]}>`
  wraps any page that requires auth. If the visitor isn't logged in, it stores
  the job id (if provided via `intendedJobId`) and redirects to the right
  login page (`/auth/login` for candidates, `/auth/admin/login` for
  admin-only pages) with `?next=` for non-job pages.
- **Return-to-intended-job flow, end to end**:
  1. Anonymous candidate hits `/jobs/{id}/apply` → `ProtectedRoute` stores
     `id` in `sessionStorage` and redirects to `/auth/login`.
  2. On submit, the login page reads that id via `consumeIntendedJobId()`
     and sends it as `intended_job_id` in the login request.
  3. The backend returns `redirect_to`; the frontend `router.push`es there.
  4. Registration follows the same pattern for brand-new candidates.

## Security notes

- Same generic error for "unknown email" and "wrong password" on both login
  endpoints — prevents account enumeration.
- Admin login endpoint rejects candidate credentials with the same generic
  message, rather than a distinguishable "wrong role" error.
- Forgot-password always returns success regardless of whether the email
  exists.
- Reset tokens: random 32-byte `secrets.token_urlsafe`, stored as a hash,
  expire in 30 minutes, single use.
- Passwords: bcrypt via passlib; registration and reset both require 8+
  chars with upper/lower/digit.

## Try it locally

```bash
docker compose up --build
docker compose exec backend alembic upgrade head
```

- Candidate: visit `http://localhost:3000/auth/register`
- Admin: an admin account must currently be seeded directly in the DB
  (`role = 'Admin'` on `users`, plus a matching `admins` row) — a seed
  script/CLI is planned for Sprint 1 follow-up once the admin domain module
  is built out.
