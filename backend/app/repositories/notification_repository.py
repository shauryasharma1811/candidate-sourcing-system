import uuid

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationStatus
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: Session):
        super().__init__(Notification, db)

    def list_for_admin(self, admin_id: uuid.UUID, skip: int, limit: int) -> tuple[list[Notification], int]:
        query = self.db.query(Notification).filter(Notification.admin_recipient_id == admin_id)
        query = query.order_by(Notification.created_at.desc())
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return items, total

    def count_unread_for_admin(self, admin_id: uuid.UUID) -> int:
        return (
            self.db.query(Notification)
            .filter(Notification.admin_recipient_id == admin_id, Notification.status != NotificationStatus.READ)
            .count()
        )

    def mark_read(self, notification: Notification) -> Notification:
        from datetime import datetime, timezone

        notification.status = NotificationStatus.READ
        notification.read_at = datetime.now(timezone.utc)
        return self.update(notification)
