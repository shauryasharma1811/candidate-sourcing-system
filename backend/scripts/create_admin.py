"""
Bootstrap the first Admin account.

Every admin-management endpoint in this system requires admin auth to call,
which makes creating the very first Admin a chicken-and-egg problem on a
fresh deploy. This script creates (or updates) an Admin user directly
against the database, bypassing the API, so a fresh deployment has a way in.

Usage (interactive — prompts for anything not passed as a flag):

    python scripts/create_admin.py

Usage (non-interactive, e.g. in a deploy pipeline / Docker entrypoint):

    python scripts/create_admin.py \
        --email admin@company.com \
        --password 'A-Strong-Passw0rd!' \
        --first-name Jane \
        --last-name Doe \
        --department "Talent Acquisition"

Or via environment variables (handy for CI/CD or a one-off container run,
since it avoids the password showing up in shell history / process list):

    ADMIN_EMAIL=admin@company.com \
    ADMIN_PASSWORD='A-Strong-Passw0rd!' \
    ADMIN_FIRST_NAME=Jane \
    ADMIN_LAST_NAME=Doe \
    python scripts/create_admin.py

Idempotent: if a user with the given email already exists, the script will
not create a duplicate. If that existing user is already an Admin, it
leaves it untouched (unless --force is passed, which resets the password
and, if needed, promotes the account to Admin). If the email belongs to a
non-Admin (e.g. a Candidate), the script refuses unless --force is passed.

Exit codes: 0 = success (created, updated, or already exists as-is),
1 = validation/user error, 2 = unexpected error.
"""
from __future__ import annotations

import argparse
import getpass
import os
import re
import sys
from pathlib import Path

# Allow running as `python scripts/create_admin.py` from the backend/ dir
# without needing the package pre-installed.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.common.enums import UserRole  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.admin import Admin  # noqa: E402

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def _validate_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError(f"'{email}' is not a valid email address")
    return email


def _validate_password(password: str) -> str:
    # Mirrors the strength rule enforced by the registration schema so a
    # bootstrap admin can't accidentally get a weaker password than a
    # normal signup would allow.
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one letter and one digit")
    return password


def _validate_name(name: str, field: str) -> str:
    name = name.strip()
    if not name or len(name) > 50:
        raise ValueError(f"{field} must be 1-50 characters")
    return name


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update the bootstrap Admin account.")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL"))
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"))
    parser.add_argument("--first-name", default=os.getenv("ADMIN_FIRST_NAME"))
    parser.add_argument("--last-name", default=os.getenv("ADMIN_LAST_NAME"))
    parser.add_argument("--department", default=os.getenv("ADMIN_DEPARTMENT"))
    parser.add_argument(
        "--force",
        action="store_true",
        help="If the email already exists, reset its password and promote it to Admin if needed.",
    )
    return parser.parse_args()


def prompt_missing(args: argparse.Namespace) -> None:
    """Interactively fill in any field not supplied via flag/env var."""
    if not args.email:
        args.email = input("Admin email: ").strip()
    if not args.first_name:
        args.first_name = input("First name: ").strip()
    if not args.last_name:
        args.last_name = input("Last name: ").strip()
    if not args.department:
        args.department = input("Department (optional, press Enter to skip): ").strip() or None
    if not args.password:
        while True:
            pw1 = getpass.getpass("Admin password: ")
            pw2 = getpass.getpass("Confirm password: ")
            if pw1 != pw2:
                print("Passwords do not match, try again.\n")
                continue
            args.password = pw1
            break


def main() -> int:
    args = parse_args()
    prompt_missing(args)

    try:
        email = _validate_email(args.email)
        password = _validate_password(args.password)
        first_name = _validate_name(args.first_name, "First name")
        last_name = _validate_name(args.last_name, "Last name")
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    department = (args.department or "").strip() or None

    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.email == email).one_or_none()

        if existing_user is None:
            user = User(
                email=email,
                password_hash=hash_password(password),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(user)
            db.flush()  # populate user.id before creating the Admin row

            admin = Admin(
                user_id=user.id,
                first_name=first_name,
                last_name=last_name,
                department=department,
            )
            db.add(admin)
            db.commit()
            print(f"Created new Admin account for {email}.")
            return 0

        # Email already exists.
        if existing_user.role != UserRole.ADMIN and not args.force:
            print(
                f"Error: {email} already exists as a {existing_user.role.value} account. "
                "Re-run with --force to promote it to Admin.",
                file=sys.stderr,
            )
            return 1

        if existing_user.role == UserRole.ADMIN and not args.force:
            print(f"{email} is already an Admin — nothing to do. Use --force to reset its password.")
            return 0

        # --force path: promote/update in place.
        existing_user.role = UserRole.ADMIN
        existing_user.password_hash = hash_password(password)
        existing_user.is_active = True

        admin = db.query(Admin).filter(Admin.user_id == existing_user.id).one_or_none()
        if admin is None:
            admin = Admin(
                user_id=existing_user.id,
                first_name=first_name,
                last_name=last_name,
                department=department,
            )
            db.add(admin)
        else:
            admin.first_name = first_name
            admin.last_name = last_name
            admin.department = department

        db.commit()
        print(f"Updated existing account for {email} to Admin with a new password.")
        return 0
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"Unexpected error while creating admin: {exc}", file=sys.stderr)
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
