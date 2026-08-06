"""
Celery Tasks cho hệ thống Notification.

Quy tắc:
- Mọi task phải dùng @shared_task để không phụ thuộc vào celery app cụ thể.
- Task chỉ nhận primitive data (ID) chứ không nhận Django objects (tránh serialization lỗi).
- Task phải idempotent (chạy nhiều lần kết quả như nhau).
- Không raise exception ra ngoài khi gửi mail thất bại — chỉ log lỗi.
"""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # Retry sau 60 giây nếu thất bại
    name="system.tasks.send_notification_email_task",
)
def send_notification_email_task(self, notification_id: int):
    """
    Gửi email thông báo cho một Notification record.

    Args:
        notification_id (int): ID của Notification cần gửi email.

    Quy trình:
        1. Lấy Notification từ DB.
        2. Kiểm tra chưa gửi (is_sent_email=False).
        3. Gửi email (tạm thời dùng Django send_mail).
        4. Cập nhật is_sent_email=True và sent_at.
        5. Nếu lỗi: retry tối đa 3 lần.
    """
    from system.models import Notification

    try:
        notification = Notification.objects.select_related("user").get(
            pk=notification_id
        )
    except Notification.DoesNotExist:
        logger.warning(
            f"[Celery] Notification ID={notification_id} không tồn tại. Bỏ qua."
        )
        return

    # Idempotent: nếu đã gửi rồi thì không gửi lại
    if notification.is_sent_email:
        logger.info(
            f"[Celery] Notification ID={notification_id} đã được gửi email trước đó. Bỏ qua."
        )
        return

    user = notification.user

    if not user or not user.email:
        logger.warning(
            f"[Celery] Notification ID={notification_id}: User không có email. Bỏ qua."
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

        # Đánh dấu đã gửi thành công
        notification.is_sent_email = True
        notification.sent_at = timezone.now()
        notification.save(update_fields=["is_sent_email", "sent_at"])

        logger.info(
            f"[Celery] Gửi email thành công: Notification ID={notification_id} -> {user.email}"
        )

    except Exception as exc:
        logger.error(
            f"[Celery] Gửi email thất bại: Notification ID={notification_id}. Lỗi: {exc}"
        )
        # Retry tự động (tối đa 3 lần, mỗi lần cách 60 giây)
        raise self.retry(exc=exc)
