from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_role
from app.common.enums import UserRole
from app.db.session import get_db
from app.models.user import User
from app.repositories.profile_repository import AdminRepository
from app.schemas.response import SuccessResponse
from app.services.notification_service import AdminNotificationService

router = APIRouter(
    prefix="/admin/notifications",
    tags=["notifications (admin)"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


def _current_admin_id(db: Session, user: User):
    admin = AdminRepository(db).get_by_user_id(user.id)
    return admin.id if admin else None


@router.get("", response_model=SuccessResponse)
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    admin_id = _current_admin_id(db, user)
    data, meta = AdminNotificationService(db).list_for_admin(admin_id, page=page, page_size=page_size)
    return SuccessResponse(message="Notifications retrieved", data=data, meta=meta.model_dump())


@router.get("/unread-count", response_model=SuccessResponse)
def get_unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    admin_id = _current_admin_id(db, user)
    count = AdminNotificationService(db).unread_count(admin_id)
    return SuccessResponse(message="Unread count retrieved", data={"unread_count": count})


@router.patch("/{notification_id}/read", response_model=SuccessResponse)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import uuid

    admin_id = _current_admin_id(db, user)
    notification = AdminNotificationService(db).mark_read(admin_id, uuid.UUID(notification_id))
    return SuccessResponse(message="Notification marked as read", data={"id": str(notification.id)})
