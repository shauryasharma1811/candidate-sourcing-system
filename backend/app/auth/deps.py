"""
FastAPI dependencies enforcing authentication + RBAC.
Backend remains the sole authority for permissions (per BRD).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.common.enums import UserRole
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

# auto_error=False (M-2): FastAPI/Starlette's HTTPBearer defaults to raising
# a 403 when the Authorization header is missing entirely, which conflicts
# with this API's documented contract (401 for "not authenticated", 403 for
# "authenticated but not permitted"). With auto_error=False, a missing
# header just makes `credentials` None, so we can raise 401 for it
# ourselves below and reserve 403 for require_role()'s "wrong role" case.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired access token")

    user = db.get(User, payload.get("sub"))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_role(*allowed_roles: UserRole):
    """Usage: Depends(require_role(UserRole.ADMIN))"""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return checker
