"""
Notification dispatch — email (SMTP) and in-app (notifications table),
covering every event in the BRD's notification architecture:

  Application Submitted    -> every Admin (in-app)
  Submission Confirmation  -> Candidate (in-app + email)
  Status Change            -> Candidate (in-app + email) — the BRD's
                               'future-ready' event, now fully wired

Delivery is synchronous and best-effort: a failed email is logged and
recorded as such (record_notification's `delivered` flag), but never
fails the request that triggered it. Swapping this onto an async
background-worker queue later only touches the internals here — the
call sites in ApplicationService don't change.
"""
import logging
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _send_email(to_email: str, subject: str, body: str) -> bool:
    """Best-effort synchronous SMTP send shared by every transactional
    email in this module. In DEBUG this only logs (no SMTP server is
    assumed to be configured locally). A failure here is logged and
    swallowed — email delivery must never fail the request that triggered
    it (e.g. application submission already succeeded and was committed
    by the time this runs).
    """
    from app.core.config import settings

    if settings.DEBUG:
        logger.info("Email to %s | %s\n%s", to_email, subject, body)
        return True

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        logger.info("Email dispatched to %s (%s)", to_email, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s (%s)", to_email, subject)
        return False


def send_application_confirmation_email(
    to_email: str,
    candidate_name: str,
    job_title: str,
    application_code: str,
) -> bool:
    """Submission Confirmation -> Candidate, per the notification
    architecture. Sent synchronously right after commit; TODO(Sprint 6):
    move onto the async background-worker queue alongside the in-app row."""
    subject = f"Application received — {job_title}"
    body = (
        f"Hi {candidate_name},\n\n"
        f"We've received your application for {job_title}.\n\n"
        f"Application ID: {application_code}\n\n"
        "You can track its status any time from \"My Applications\".\n\n"
        "Thanks for applying."
    )
    return _send_email(to_email, subject, body)


def send_password_reset_email(to_email: str, raw_token: str) -> bool:
    """
    Sends the password reset link (H-3).

    Builds a real, usable reset URL against settings.FRONTEND_URL (e.g.
    "https://app.example.com/reset-password?token=..."), states the
    expiry window, and sends it through the same best-effort SMTP path
    used by every other transactional email in this module. In DEBUG mode
    _send_email() only logs (matching local-dev behaviour elsewhere in
    this file) — but the full link and expiry text are still built and
    logged here, not just a bare token, so DEBUG output is actually
    usable for local testing (click/copy the link straight from the log).
    """
    from app.core.config import settings

    reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
    expiry_minutes = settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES

    subject = f"{settings.APP_NAME}: reset your password"
    body = (
        f"Hi,\n\n"
        f"We received a request to reset the password for {to_email}.\n\n"
        f"Reset your password using this link:\n{reset_link}\n\n"
        f"This link expires in {expiry_minutes} minutes. If you didn't request "
        "this, you can safely ignore this email — your password will not be changed.\n\n"
        f"— {settings.APP_NAME}"
    )
    return _send_email(to_email, subject, body)


def send_status_change_email(
    to_email: str,
    candidate_name: str,
    job_title: str,
    application_code: str,
    new_status: str,
) -> bool:
    """Status Change -> Candidate, per the notification architecture's
    'future-ready' event. Same synchronous best-effort SMTP path as the
    submission confirmation; wired up here so a background-worker swap in
    Sprint 6 only has to change how this function is *called*, not what it
    sends."""
    subject = f"Update on your application — {job_title}"
    body = (
        f"Hi {candidate_name},\n\n"
        f"There's an update on your application for {job_title} (Application ID: {application_code}).\n\n"
        f"New status: {new_status}\n\n"
        "You can track full details any time from \"My Applications\".\n\n"
        "Thanks for your patience."
    )
    return _send_email(to_email, subject, body)


def record_notification(
    db,
    *,
    event,
    channel,
    subject: str,
    admin_recipient_id=None,
    candidate_recipient_id=None,
    application_id=None,
    payload: dict | None = None,
    delivered: bool = True,
):
    """Writes one row to the notifications table, reflecting whatever
    actually happened on the channel (a DB write for in-app is always a
    success; an email's `delivered` flag comes from the real SMTP result).
    Every caller that fans a single business event out across channels —
    e.g. Submission Confirmation going both in-app and email — calls this
    once per channel, so the notifications table stays queryable per
    channel per event, not just per event."""
    from datetime import datetime, timezone

    from app.models.notification import Notification, NotificationStatus
    from app.repositories.notification_repository import NotificationRepository

    now = datetime.now(timezone.utc)
    notification = Notification(
        event=event,
        channel=channel,
        status=NotificationStatus.SENT if delivered else NotificationStatus.FAILED,
        admin_recipient_id=admin_recipient_id,
        candidate_recipient_id=candidate_recipient_id,
        application_id=application_id,
        subject=subject,
        payload=payload or {},
        sent_at=now if delivered else None,
    )
    return NotificationRepository(db).create(notification)


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
