"""
Module: system.tasks
Description: Asynchronous Celery background tasks for dispatching notification email messages.
"""

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="system.tasks.send_notification_email_task",
)
def send_notification_email_task(self, notification_id: int):
    """Execute asynchronous email dispatch for a specific notification record with automatic retry."""
    from system.models import Notification

    try:
        notification = Notification.objects.select_related("user").get(
            pk=notification_id
        )
    except Notification.DoesNotExist:
        logger.warning(
            f"[Celery] Notification ID={notification_id} does not exist. Skipping."
        )
        return

    if notification.is_sent_email:
        logger.info(
            f"[Celery] Notification ID={notification_id} has already been sent via email. Skipping."
        )
        return

    user = notification.user

    if not user or not user.email:
        logger.warning(
            f"[Celery] Notification ID={notification_id}: User has no email address. Skipping."
        )
        return

    try:
        from django.core.mail import send_mail
        from django.conf import settings

        send_mail(
            subject=f"[WorkTracker] {notification.title}",
            message=notification.content or notification.title,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@worktracker.local"),
            recipient_list=[user.email],
            fail_silently=False,
        )

        notification.is_sent_email = True
        notification.sent_at = timezone.now()
        notification.save(update_fields=["is_sent_email", "sent_at"])

        logger.info(
            f"[Celery] Email sent successfully: Notification ID={notification_id} -> {user.email}"
        )

    except Exception as exc:
        logger.error(
            f"[Celery] Failed sending email: Notification ID={notification_id}. Error: {exc}"
        )
        raise self.retry(exc=exc)
