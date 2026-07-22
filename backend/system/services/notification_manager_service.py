from django.contrib.auth import get_user_model

from system.models import Notification
from tasks.models import TaskFollower


def normalize_user_id(user_or_id):
    """
    Nhận user object hoặc user id.
    Trả về user id.
    """
    if user_or_id is None:
        return None

    if isinstance(user_or_id, int):
        return user_or_id

    return getattr(user_or_id, "id", None)


def unique_user_ids(users):
    """
    Loại trùng user id và bỏ giá trị None.
    """
    result = []

    for item in users:
        user_id = normalize_user_id(item)

        if user_id and user_id not in result:
            result.append(user_id)

    return result


def validate_event_type(event_type):
    valid_event_types = {
        value
        for value, label in Notification.EventType.choices
    }

    if event_type not in valid_event_types:
        raise ValueError(f"Invalid notification event_type: {event_type}")


def validate_channel(channel):
    valid_channels = {
        value
        for value, label in Notification.ChannelType.choices
    }

    if channel not in valid_channels:
        raise ValueError(f"Invalid notification channel: {channel}")


def push_realtime_best_effort(notifications):
    """
    Push Notification real-time qua Django Channels.

    Mỗi user được group riêng: "user_{user_id}".
    NotificationConsumer sẽ forward payload xuống client.

    Hàm này không được raise lỗi làm hỏng transaction chính.
    """
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
    """
    Đẩy task gửi email vào Celery Queue.

    Mỗi Notification được enqueue riêng lẻ.
    Hàm này không được raise lỗi làm hỏng transaction chính.
    """
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
    """
    Tạo notification cho danh sách recipients.

    Quy tắc:
    - Persist DB trước.
    - Realtime/email là best-effort.
    - Không tự rollback thao tác nghiệp vụ nếu realtime/email lỗi.
    """
    validate_event_type(event_type)
    validate_channel(channel)

    recipient_ids = unique_user_ids(recipients)

    if not recipient_ids:
        return []

    User = get_user_model()

    active_user_ids = list(
        User.objects.filter(
            id__in=recipient_ids,
            is_active=True,
        ).values_list("id", flat=True)
    )

    notifications = [
        Notification(
            user_id=user_id,
            event_type=event_type,
            type=channel,
            title=title,
            content=content,
            related_url=related_url,
        )
        for user_id in active_user_ids
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
    """
    Xác định người nhận notification cho task event.

    Gồm:
    - assignee
    - creator
    - manager của job
    - followers của task

    exclude_user:
    - dùng để không gửi thông báo cho chính người vừa thực hiện hành động.
    """
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