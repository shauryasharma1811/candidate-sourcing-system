import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.common.enums import NotificationEvent
from app.models.notification import NotificationStatus


class NotificationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event: NotificationEvent
    status: NotificationStatus
    subject: str | None
    application_id: uuid.UUID | None
    created_at: datetime
    read_at: datetime | None
