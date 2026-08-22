"""
Shared fixtures for the whole test suite.

Uses a real Postgres database (DATABASE_URL from .env / the test
environment) rather than SQLite, because the models rely on
postgres-specific types (UUID, JSONB) and enums. Each test runs inside
a SAVEPOINT that's rolled back afterwards, so tests never see each
other's data and the DB starts clean every run.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401 — populate Base.metadata with every table
from app.common.enums import EmploymentType, JobStatus, UserRole
from app.core.security import create_access_token, hash_password
from app.db.session import Base, engine, get_db
from app.main import app
from app.models.admin import Admin
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User


# ---------------------------------------------------------------------
# Schema lifecycle — created once for the whole test session
# ---------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _fast_password_hashing():
    """Production uses bcrypt's default cost factor (~12 rounds), which is
    correctly slow for real password storage but adds ~150ms per call —
    the test suite creates a fresh user (and hashes a password) in nearly
    every test. Dropping the cost factor for the test session only keeps
    the same hashing scheme under test while making the suite run in a
    reasonable time; nothing about app.core.security's production
    behavior changes."""
    from app.core import security

    original_context = security.pwd_context
    security.pwd_context = security.CryptContext(schemes=["bcrypt"], bcrypt__rounds=4, deprecated="auto")
    yield
    security.pwd_context = original_context


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------
# Per-test isolated session: outer transaction + SAVEPOINT, rolled back
# after every test regardless of commits made inside the request.
# ---------------------------------------------------------------------
@pytest.fixture
def db() -> Session:
    connection = engine.connect()
    outer_txn = connection.begin()
    session = sessionmaker(bind=connection, autoflush=False, autocommit=False, future=True)()

    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, txn):
        if txn.nested and not txn._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        outer_txn.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def _no_real_s3(monkeypatch):
    """Every test runs against a fake S3 endpoint (see .env) that isn't
    reachable — replace the network-touching storage_service functions
    with no-ops so upload/delete/download-link flows can be tested
    without a real S3/MinIO instance."""
    import app.services.storage_service as storage_service

    monkeypatch.setattr(storage_service, "upload_resume", lambda file, object_key: None)
    monkeypatch.setattr(storage_service, "delete_resume", lambda object_key: None)
    monkeypatch.setattr(storage_service, "upload_photo", lambda file, object_key: None)
    monkeypatch.setattr(storage_service, "delete_photo", lambda object_key: None)
    monkeypatch.setattr(
        storage_service,
        "get_presigned_download_url",
        lambda object_key, download_filename, mime_type=None, expires_in=None: f"https://signed.example/{object_key}",
    )
    monkeypatch.setattr(storage_service, "ensure_bucket_lifecycle_policy", lambda: None)
    # app.main imports this name directly (`from ... import ensure_bucket_lifecycle_policy`),
    # so it's a separate binding from storage_service's — patching the module
    # attribute above does NOT affect app.main's copy. Patch that too, or the
    # startup event still fires a real (hanging) boto3 call on every TestClient.
    import app.main as main_module

    monkeypatch.setattr(main_module, "ensure_bucket_lifecycle_policy", lambda: None)


@pytest.fixture
def client(db: Session, _no_real_s3):
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------
@pytest.fixture
def make_candidate(db: Session):
    """Creates a User(role=Candidate) + Candidate row, returns (user, candidate)."""

    def _make(email: str | None = None, password: str = "Password123", **candidate_kwargs) -> tuple[User, Candidate]:
        email = email or f"candidate-{uuid.uuid4().hex[:10]}@example.com"
        user = User(email=email, password_hash=hash_password(password), role=UserRole.CANDIDATE)
        db.add(user)
        db.flush()

        defaults = dict(
            user_id=user.id,
            first_name="Test",
            last_name="Candidate",
            mobile="+919876543210",
            location="Bengaluru",
            consent=True,
        )
        defaults.update(candidate_kwargs)
        candidate = Candidate(**defaults)
        db.add(candidate)
        db.commit()
        db.refresh(user)
        db.refresh(candidate)
        return user, candidate

    return _make


@pytest.fixture
def make_admin(db: Session):
    """Creates a User(role=Admin) + Admin row, returns (user, admin)."""

    def _make(email: str | None = None, password: str = "Password123", **admin_kwargs) -> tuple[User, Admin]:
        email = email or f"admin-{uuid.uuid4().hex[:10]}@example.com"
        user = User(email=email, password_hash=hash_password(password), role=UserRole.ADMIN)
        db.add(user)
        db.flush()

        defaults = dict(user_id=user.id, first_name="Test", last_name="Admin", department="Talent Acquisition")
        defaults.update(admin_kwargs)
        admin = Admin(**defaults)
        db.add(admin)
        db.commit()
        db.refresh(user)
        db.refresh(admin)
        return user, admin

    return _make


@pytest.fixture
def make_job(db: Session):
    """Creates a Job requisition, defaulting to Published so public/search
    tests can find it immediately."""

    def _make(created_by_admin_id: uuid.UUID | None = None, **job_kwargs) -> Job:
        defaults = dict(
            title="Backend Engineer",
            requisition_code=f"REQ-{uuid.uuid4().hex[:8].upper()}",
            department="Engineering",
            location="Bengaluru",
            employment_type=EmploymentType.FULL_TIME,
            experience_required="2-4 years",
            openings=2,
            hiring_manager="Jane Doe",
            max_salary=Decimal("1800000.00"),
            hiring_completion_date=date.today() + timedelta(days=60),
            description="Build things.",
            requirements="Python, SQL",
            status=JobStatus.PUBLISHED,
            created_by_admin_id=created_by_admin_id,
        )
        defaults.update(job_kwargs)
        job = Job(**defaults)
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    return _make


def auth_headers(user: User) -> dict:
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def candidate_client(db: Session, make_candidate, _no_real_s3):
    """A dedicated TestClient (own headers) plus a ready-made logged-in
    candidate. A distinct instance from `client`/`admin_client` — sharing
    one TestClient across roles would mean the last role's auth header
    clobbers the others', since headers live on the client, not the
    request."""

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    user, candidate = make_candidate()
    with TestClient(app) as c:
        c.headers.update(auth_headers(user))
        yield c, user, candidate
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(db: Session, make_admin, _no_real_s3):
    """A dedicated TestClient (own headers) plus a ready-made logged-in admin."""

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    user, admin = make_admin()
    with TestClient(app) as c:
        c.headers.update(auth_headers(user))
        yield c, user, admin
    app.dependency_overrides.clear()
