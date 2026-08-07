# 04 — Celery Giai đoạn 3-4: task thật + tích hợp, test end-to-end

Nối tiếp [02-celery-setup.md](02-celery-setup.md) (Giai đoạn 1-2: hạ tầng +
task "hello world"). Phần này viết task gửi mail thật và nối nó vào chỗ
"cắm" đã có sẵn trong code của Long/MinhAnh.

## Giai đoạn 3 — `send_notification_email_task`

Quyết định có bàn trước khi gõ: NFR-20 chỉ nói "lỗi mạng/SMTP tạm thời thì
retry", không nói bắt loại exception nào cụ thể. Có 2 lựa chọn:

- Bắt hết `Exception` — đơn giản, nhưng sẽ retry cả những lỗi không nên
  retry (VD 1 bug code thật, hoặc `Notification.DoesNotExist` nếu record bị
  xoá trước khi task chạy — retry không sửa được 2 loại lỗi này).
- Bắt cụ thể `smtplib.SMTPException`, `ConnectionError`, `TimeoutError` —
  đúng đúng phạm vi "lỗi mạng/SMTP tạm thời", để lỗi code thật lộ ra ngay
  thay vì bị nuốt bởi cơ chế retry.

Chọn phương án 2.

`backend/system/tasks.py` (thêm vào cuối, sau task `ping` đã có từ Giai
đoạn 2 — import gộp chung lên đầu file):

```python
import smtplib

from celery import shared_task
from django.core.mail import send_mail
from django.utils import timezone

from .models import Notification


@shared_task
def ping():
    print("Celery is working!")
    return "pong"


# Sends the email for one notification and marks it sent. Retries on
# transient SMTP/network failures (NFR-20); does not retry on a missing
# notification or a real programming error.
@shared_task(
    autoretry_for=(smtplib.SMTPException, ConnectionError, TimeoutError),
    retry_backoff=True,
    max_retries=5,
)
def send_notification_email_task(notification_id):
    notification = Notification.objects.get(id=notification_id)

    send_mail(
        subject=notification.title,
        message=notification.content or "",
        from_email=None,
        recipient_list=[notification.user.email],
    )

    notification.is_sent_email = True
    notification.sent_at = timezone.now()
    notification.save(update_fields=["is_sent_email", "sent_at"])
```

Điểm cần nhớ:
- Task nhận `notification_id` (int), không nhận thẳng object `Notification`
  — tham số Celery phải serialize được qua JSON để gửi vào Redis, object
  Model không tự serialize được.
- `notification.content or ""` — field `content` cho phép `null`, nhưng
  `send_mail()` cần 1 chuỗi, không nhận `None`.
- `retry_backoff=True` + `max_retries=5` — mỗi lần retry chờ lâu hơn theo
  cấp số nhân, không dồn dập gọi lại SMTP server đang gặp sự cố, và không
  retry vô hạn nếu server hỏng thật.

**Lỗi nhỏ gặp khi gõ**: lúc đầu dán 4 dòng import mới (`smtplib`,
`send_mail`, `timezone`, `Notification`) vào **giữa file**, sau khi hàm
`ping` đã kết thúc — chạy vẫn đúng (Python cho import ở bất kỳ đâu ở cấp
module), nhưng sai convention (mọi file khác trong project gom import lên
đầu). Đã dọn lại đúng vị trí.

## Giai đoạn 4 — Tích hợp vào `enqueue_email_best_effort()`

`backend/system/services/notification_manager_service.py` đã có sẵn hàm
này ở dạng placeholder (code mẫu nằm trong comment) từ trước, chỉ cần bỏ
comment và sửa docstring:

```python
def enqueue_email_best_effort(notifications):
    """
    Best-effort enqueue of the Celery email task for each notification.

    Hàm này không được raise lỗi làm hỏng transaction chính.
    """
    try:
        from system.tasks import send_notification_email_task

        for notification in notifications:
            send_notification_email_task.delay(notification.id)
        return None
    except Exception:
        return None
```

Giữ nguyên 2 điều quan trọng từ code mẫu gốc:
- Import `send_notification_email_task` **bên trong** hàm (local import),
  không đưa lên đầu file.
- Khối `try/except Exception: return None` bao ngoài cùng — nếu bản thân
  việc **enqueue** vào Redis lỗi (VD Redis down lúc đó), lỗi này không được
  làm hỏng transaction chính đang tạo `Notification` trong DB. Đây là đúng
  tinh thần "best-effort" đã ghi trong docstring gốc: notification phải
  luôn lưu DB thành công, việc gửi mail là phụ, có thể thất bại độc lập.

`notify()` chỉ gọi `enqueue_email_best_effort()` khi
`channel in {EMAIL_ONLY, ALL}` — notification tạo với `channel=SYSTEM_ONLY`
(mặc định) sẽ không kích hoạt task email nào cả.

## Verify — test end-to-end thật, không chỉ đọc code

Phải restart lại `celery worker` trước khi test (bài học từ Giai đoạn 2:
worker không tự nhận task mới nếu không restart). Log `[tasks]` xác nhận:

```
[tasks]
  . system.tasks.ping
  . system.tasks.send_notification_email_task
```

Gọi `notify()` qua `manage.py shell` với `channel=EMAIL_ONLY`:

```python
from django.contrib.auth import get_user_model
from system.services.notification_manager_service import notify
from system.models import Notification

User = get_user_model()
me = User.objects.get(email="admin@worktracker.com")

created = notify(
    recipients=[me],
    event_type="LOG_WORK_APPROVED",
    title="Celery email test",
    content="Testing send_notification_email_task end-to-end.",
    channel=Notification.ChannelType.EMAIL_ONLY,
)
```

Log worker xác nhận task nhận, chạy, và in ra đúng nội dung "email" (vì
`EMAIL_BACKEND` đang là console backend cho dev — in ra terminal thay vì
gửi thật):

```
Task system.tasks.send_notification_email_task[8baa220e-...] received
Subject: Celery email test
From: no-reply@worktracker.com
To: admin@worktracker.com
Testing send_notification_email_task end-to-end.
Task system.tasks.send_notification_email_task[8baa220e-...] succeeded in 0.04s: None
```

Kiểm tra lại DB xác nhận field cập nhật đúng:

```python
n = Notification.objects.get(id=2)
n.is_sent_email  # True
n.sent_at        # 2026-07-26 07:17:23...
```

Celery Giai đoạn 1-4 pass toàn bộ. **Nợ lại**:
- Chưa test case retry thật (giả lập SMTP lỗi tạm thời để xem
  `autoretry_for`/`retry_backoff` có hoạt động đúng hay không) — cần
  cấu hình SMTP thật hoặc cố tình mock lỗi, chưa làm trong phiên này.
- Chưa cấu hình `EMAIL_BACKEND` production thật (SMTP) — vẫn đang dùng
  console backend của dev.
- Chưa báo với Đức Long cách chạy `celery -A worktracker_core worker` song
  song `runserver` khi dev, theo đúng yêu cầu roadmap Tuần 2.
