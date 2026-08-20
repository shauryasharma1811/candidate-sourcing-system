"""
Minimal notification stub used by auth flows in Sprint 1.
Full async email/in-app notification dispatch (background workers, templates,
the notifications table) is built out in Sprint 6 — this function is the
integration point that later work will replace internals of, without callers
needing to change.
"""
import logging

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, raw_token: str) -> None:
    """
    Sends the password reset link. In development this just logs — swap the
    body for a real SMTP/async call in Sprint 6's notification_service buildout.
    Never log the raw token in production; kept here only for local dev visibility.
    """
    from app.core.config import settings

    reset_link = f"{settings.APP_NAME}: password reset requested for {to_email}"
    if settings.DEBUG:
        logger.info("Password reset token for %s: %s", to_email, raw_token)
    else:
        logger.info("Password reset email dispatched to %s", to_email)
    # TODO(Sprint 6): replace with aiosmtplib-based async send + notifications row


class AdminNotificationService:
    """Read-only listing over the existing notifications table. Async
    dispatch (background workers, email templates) is Sprint 6 — this only
    supports the admin notification bell/list until that lands."""

    def __init__(self, db):
        from app.repositories.notification_repository import NotificationRepository

        self.db = db
        self.notifications = NotificationRepository(db)

    def list_for_admin(self, admin_id, page: int = 1, page_size: int = 20):
        import math

        from app.schemas.common import PaginatedMeta
        from app.schemas.notification import NotificationListItem

        page = max(page, 1)
        page_size = min(max(page_size, 1), 50)
        skip = (page - 1) * page_size

        items, total = self.notifications.list_for_admin(admin_id, skip=skip, limit=page_size)
        data = [NotificationListItem.model_validate(n) for n in items]
        meta = PaginatedMeta(page=page, page_size=page_size, total=total, total_pages=max(1, math.ceil(total / page_size)))
        return data, meta

    def unread_count(self, admin_id) -> int:
        return self.notifications.count_unread_for_admin(admin_id)

    def mark_read(self, admin_id, notification_id):
        from fastapi import HTTPException, status

        notification = self.notifications.get(notification_id)
        if not notification or notification.admin_recipient_id != admin_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
        return self.notifications.mark_read(notification)
