"""
Module: system.services.notification_manager_service
Description: Service functions for persisting, broadcasting, and enqueuing system notifications.
"""

from django.contrib.auth import get_user_model
from system.models import Notification
from tasks.models import TaskFollower


def normalize_user_id(user_or_id):
    """Normalize user model instance or integer into a user ID integer."""
    if user_or_id is None:
        return None

    if isinstance(user_or_id, int):
        return user_or_id

    return getattr(user_or_id, "id", None)


def unique_user_ids(users):
    """Filter distinct non-null user IDs from a collection of users or IDs."""
    result = []

    for item in users:
        user_id = normalize_user_id(item)

        if user_id and user_id not in result:
            result.append(user_id)

    return result


def validate_event_type(event_type):
    """Validate that the event type string exists in Notification.EventType choices."""
    valid_event_types = {
        value
        for value, label in Notification.EventType.choices
    }

    if event_type not in valid_event_types:
        raise ValueError(f"Invalid notification event_type: {event_type}")


def validate_channel(channel):
    """Validate that the delivery channel string exists in Notification.ChannelType choices."""
    valid_channels = {
        value
        for value, label in Notification.ChannelType.choices
    }

    if channel not in valid_channels:
        raise ValueError(f"Invalid notification channel: {channel}")


def push_realtime_best_effort(notifications):
    """Broadcast notification payloads across Django Channels WebSocket groups on best-effort basis."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()

        if channel_layer is None:
            return None

        for notification in notifications:
            async_to_sync(channel_layer.group_send)(
                f"user_{notification.user_id}",
                {
                    "type": "notification.message",
                    "payload": {
                        "id": notification.id,
                        "event_type": notification.event_type,
                        "title": notification.title,
                        "content": notification.content,
                        "related_url": notification.related_url,
                        "created_at": notification.created_at.isoformat() if notification.created_at else None,
                    },
                },
            )

        return None

    except Exception:
        return None


def enqueue_email_best_effort(notifications):
    """Enqueue asynchronous email delivery tasks for notification instances into Celery."""
    try:
        from system.tasks import send_notification_email_task

        for notification in notifications:
            send_notification_email_task.delay(notification.id)

        return None

    except Exception:
        return None


def notify(
    *,
    recipients,
    event_type,
    title,
    content=None,
    related_url=None,
    channel=Notification.ChannelType.SYSTEM_ONLY,
):
    """Create notification records, push to WebSocket channels, and optionally enqueue emails."""
    validate_event_type(event_type)
    validate_channel(channel)

    recipient_ids = unique_user_ids(recipients)

    if not recipient_ids:
        return []

    notifications = [
        Notification(
            user_id=user_id,
            event_type=event_type,
            type=channel,
            title=title,
            content=content,
            related_url=related_url,
        )
        for user_id in recipient_ids
    ]

    created_notifications = Notification.objects.bulk_create(notifications)

    push_realtime_best_effort(created_notifications)

    if channel in {
        Notification.ChannelType.EMAIL_ONLY,
        Notification.ChannelType.ALL,
    }:
        enqueue_email_best_effort(created_notifications)

    return created_notifications


def resolve_task_recipients(task, exclude_user=None):
    """Resolve distinct active user recipients involved with a task excluding the triggering actor."""
    exclude_user_id = normalize_user_id(exclude_user)

    user_ids = []

    if task.assignee_id:
        user_ids.append(task.assignee_id)

    if task.creator_id:
        user_ids.append(task.creator_id)

    if task.job_id and task.job.manager_id:
        user_ids.append(task.job.manager_id)

    follower_user_ids = TaskFollower.objects.filter(
        task_id=task.id
    ).values_list("user_id", flat=True)

    user_ids.extend(list(follower_user_ids))

    unique_ids = unique_user_ids(user_ids)

    if exclude_user_id:
        unique_ids = [
            user_id
            for user_id in unique_ids
            if user_id != exclude_user_id
        ]

    User = get_user_model()

    return User.objects.filter(
        id__in=unique_ids,
        is_active=True,
    )