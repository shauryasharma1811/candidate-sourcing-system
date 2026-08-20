# Candidate Sourcing System

A modular-monolith recruiting platform: public careers site, multi-step candidate
application flow, and an admin requisition/application review workspace.

This repository is **Sprint 0 — Foundation**: architecture, folder structure, Docker,
environment configuration, database schema, and API skeleton. Business logic is
implemented sprint-by-sprint on top of this locked foundation (see Sprint Roadmap below).

## Tech Stack

| Layer      | Technology                     |
|------------|---------------------------------|
| Frontend   | Next.js 15 (App Router), TypeScript |
| UI         | Tailwind CSS + Shadcn            |
| Forms      | React Hook Form + Zod            |
| Backend    | FastAPI                          |
| ORM        | SQLAlchemy 2.0                   |
| Database   | PostgreSQL 16                    |
| Auth       | JWT (access + refresh)           |
| Uploads    | S3-compatible (MinIO locally)    |
| Email      | SMTP (async, background worker)  |
| Testing    | Pytest + Playwright               |

## Architecture

```
Route  →  Controller (thin)  →  Service  →  Repository  →  Database
```

Business logic lives **only** in the service layer. Controllers parse/validate
requests and format responses. Repositories are the only layer that touches the
SQLAlchemy session. This is a modular monolith — each business domain
(`candidate`, `requisition`, `applications`, `notifications`, `auth`) owns its
own service/repository/schema files inside `backend/app/`.

## Folder Structure

```
candidate-sourcing-system/
│
├── frontend/                     # Next.js 15
│   ├── app/                      # Routes (App Router)
│   ├── components/ui/            # Shared UI: Button, Input, Modal, Table, Badge, Pagination
│   ├── features/                 # auth, jobs, applications, admin, notifications
│   ├── hooks/
│   ├── services/                 # API client wrappers
│   ├── lib/                      # apiFetch, utilities
│   ├── types/
│   └── utils/
│
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/        # Thin controllers (auth, jobs, requisitions, applications)
│   │   ├── auth/                 # RBAC dependencies
│   │   ├── candidate/            # Candidate domain module (service logic, Sprint 1+)
│   │   ├── requisition/          # Requisition domain module (Sprint 3+)
│   │   ├── applications/         # Applications domain module (Sprint 4+)
│   │   ├── notifications/        # Notification domain module (Sprint 6+)
│   │   ├── common/               # Enums, mixins shared across domains
│   │   ├── core/                 # config.py, security.py
│   │   ├── db/                   # session.py (engine, Base, get_db)
│   │   ├── models/                # SQLAlchemy ORM models
│   │   ├── repositories/         # DB access layer
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   └── services/              # Business logic
│   ├── tests/{unit,integration,e2e}
│   └── alembic/                   # Migrations
│
├── docker-compose.yml
├── .github/workflows/ci.yml
└── README.md
```

## Database ERD

```
┌───────────────┐        ┌────────────────────┐
│    users      │        │    candidates       │
├───────────────┤ 1    1 ├─────────────────────┤
│ id (PK)       ├────────┤ id (PK)             │
│ email (uniq)  │        │ user_id (FK, uniq)  │
│ password_hash │        │ first_name          │
│ role (enum)   │        │ last_name           │
│ created_at    │        │ mobile              │
│ updated_at    │        │ location            │
└───────────────┘        │ consent             │
                          └─────────┬───────────┘
                                    │ 1
                     ┌──────────────┼───────────────┐
                     │ N                             │ N
          ┌──────────▼─────────┐          ┌──────────▼──────────┐
          │     education      │          │     experience       │
          ├─────────────────────┤          ├───────────────────────┤
          │ id (PK)             │          │ id (PK)               │
          │ candidate_id (FK)   │          │ candidate_id (FK)     │
          │ institution         │          │ company               │
          │ degree              │          │ title                 │
          │ field_of_study      │          │ start_date            │
          │ start_year          │          │ end_date (nullable)   │
          │ end_year (nullable) │          │ description           │
          └─────────────────────┘          └───────────────────────┘

┌───────────────────┐             ┌────────────────────────┐
│       jobs         │            │      applications        │
├─────────────────────┤   1    N  ├───────────────────────────┤
│ id (PK)             ├───────────┤ id (PK)                   │
│ title               │           │ candidate_id (FK)          │
│ requisition_id (uniq)│          │ job_id (FK)                │
│ department          │           │ status (enum)              │
│ location             │          │ resume_generated_filename  │
│ employment_type      │          │ resume_original_name       │
│ experience_required  │          │ resume_mime_type            │
│ openings             │          │ resume_size_bytes          │
│ hiring_manager        │         │ applied_at                 │
│ max_salary            │         └───────────────┬─────────────┘
│ hiring_completion_date│                          │ N
│ status (enum)          │                         │
└─────────────────────────┘             candidates.id (FK) ──┘
```

Relationships: `users 1—1 candidates`, `candidates 1—N education`,
`candidates 1—N experience`, `candidates 1—N applications`, `jobs 1—N applications`.
Resume storage paths are **never** exposed to the client — only metadata
(`generated_filename`, `original_name`, `mime_type`, `size`) is persisted on `applications`.

### Enums

```python
class JobStatus(str, Enum):
    DRAFT = "Draft"
    PUBLISHED = "Published"
    CLOSED = "Closed"

class ApplicationStatus(str, Enum):
    NEW = "New"
    REVIEWED = "Reviewed"
    SHORTLISTED = "Shortlisted"
    REJECTED = "Rejected"
```

## API Routes (`/api/v1`)

Every response follows the standard envelope:

```json
// Success
{ "success": true, "message": "Created", "data": {}, "meta": {} }

// Error
{ "success": false, "message": "Validation failed", "errors": [] }
```

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Candidate registration |
| POST | `/auth/login` | Public | Issue access + refresh tokens |
| POST | `/auth/refresh` | Public | Rotate access token |
| POST | `/auth/forgot-password` | Public | Trigger password reset |
| GET | `/auth/me` | Authenticated | Current profile |
| GET | `/jobs` | Public | Browse published jobs (search, filters, pagination) |
| GET | `/jobs/{job_id}` | Public | Job detail |
| GET | `/admin/requisitions` | Admin | List all requisitions |
| POST | `/admin/requisitions` | Admin | Create requisition (Draft) |
| GET | `/admin/requisitions/{job_id}` | Admin | Requisition detail |
| PUT | `/admin/requisitions/{job_id}` | Admin | Update requisition |
| POST | `/admin/requisitions/{job_id}/publish` | Admin | Draft → Published |
| POST | `/admin/requisitions/{job_id}/close` | Admin | → Closed |
| POST | `/applications/{job_id}/resume` | Candidate | Upload resume (≤5MB, PDF/DOC/DOCX) |
| POST | `/applications/{job_id}/submit` | Candidate | Submit full application |
| GET | `/applications/mine` | Candidate | Candidate's own applications |
| GET | `/admin/applications` | Admin | Paginated grid, filter by status/job |
| GET | `/admin/applications/{id}` | Admin | Application detail |
| PATCH | `/admin/applications/{id}/status` | Admin | Update status |
| GET | `/admin/applications/{id}/resume` | Admin | Signed resume download URL |
| GET | `/admin/applications/export` | Admin | Export CSV/Excel |

RBAC roles: **Anonymous** (browse/search/share), **Candidate** (apply, own applications),
**Admin** (requisition CRUD, publish/close, review, status updates). Enforced via
`app/auth/deps.py::require_role(...)` on every protected router.

## Authentication

- Access token: 15 min · Refresh token: 7 days (JWT, HS256)
- Passwords hashed with bcrypt
- Flow: `Register → Login → Access Token → Refresh`
- After login, candidate returns to the job they intended to apply to

## Setup Commands

### 1. Clone & configure environment

```bash
git clone <repo-url> candidate-sourcing-system
cd candidate-sourcing-system
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# edit backend/.env and frontend/.env.local with real secrets before deploying
```

### 2. Run everything with Docker (recommended)

```bash
docker compose up --build
# backend:  http://localhost:8000  (docs at /docs)
# frontend: http://localhost:3000
# minio console: http://localhost:9001 (minioadmin / minioadmin)
```

### 3. Run database migrations

```bash
docker compose exec backend alembic revision --autogenerate -m "init schema"
docker compose exec backend alembic upgrade head
```

### 4. Local (non-Docker) backend development

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 5. Local (non-Docker) frontend development

```bash
cd frontend
npm install
npm run dev
```

### 6. Run tests

```bash
# Backend unit + integration
cd backend && pytest

# Frontend E2E
cd frontend && npm run test:e2e
```

## Sprint Roadmap

| Sprint | Scope |
|---|---|
| 0 | Foundation — architecture, Docker, schema, auth design (this repo) |
| 1 | Authentication — register, login, refresh, forgot password, RBAC middleware, profile |
| 2 | Public Careers — listing, search, filters, job detail, share links |
| 3 | Requisition Management — admin dashboard, CRUD, draft/publish/close |
| 4 | Multi-Step Application — bio, education, experience, resume upload, review, submit |
| 5 | Admin Applications — paginated grid, status updates, resume download, CSV/Excel export |
| 6 | Notifications — email, in-app, notification bell |
| 7 | Testing & Deployment — unit/integration/E2E, production Docker, GitHub Actions |

## Security & Performance (enforced across all sprints)

HTTPS · JWT verification · bcrypt hashing · parameterized ORM queries · rate limiting ·
input sanitization · least privilege · no password/token/resume-content logging ·
mandatory pagination · indexed queries · lazy loading · async email dispatch.

## Git Strategy

Branches: `feature/*`, `bugfix/*`, `hotfix/*`
Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

## Locked Foundation

The following are fixed for the remainder of development and must not be changed
in later sprints without a new architecture decision record:

- Modular monolith, thin routers, services own business logic
- Repository-only database access
- Shared UI components first
- Backend-authoritative validation
- JWT + RBAC
- Standard API response shape
- Interfaces left future-ready for AI scoring / resume parsing (not implemented in Phase 1)
