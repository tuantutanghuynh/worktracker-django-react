# 02 — Celery Giai đoạn 1-2: dựng hạ tầng, 2 lỗi thật gặp phải

## Vì sao cần Celery (nhắc lại nhanh)

Gửi email là tác vụ chậm (phụ thuộc mạng/SMTP) — nếu chạy đồng bộ ngay
trong request HTTP, client phải chờ, và nếu SMTP lỗi tạm thời sẽ làm hỏng
luôn cả response. Celery tách việc này ra 1 tiến trình riêng (worker), giao
tiếp với Django qua Redis làm message broker: Django "bỏ thư" (task) vào
hàng đợi, worker liên tục lấy thư ra xử lý.

`system/services/notification_manager_service.py::enqueue_email_best_effort()`
đã có sẵn code mẫu (đang comment) đúng chỗ gọi
`send_notification_email_task.delay(...)` — không cần tự thiết kế điểm
tích hợp từ đầu, chỉ cần viết task rồi bỏ comment (việc này thuộc Giai đoạn
3-4, chưa làm trong bản ghi này).

## Giai đoạn 1 — Cài đặt + cấu hình

`requirements.txt`: thêm `celery==5.6.3` (version thật lúc cài, không phải
version cố định trước).

`worktracker_core/celery.py` (mới):
```python
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worktracker_core.settings")

app = Celery("worktracker_core")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

`worktracker_core/__init__.py` (trước đó file rỗng):
```python
from .celery import app as celery_app

__all__ = ("celery_app",)
```

Đảm bảo Celery app được load ngay khi Django khởi động — `__init__.py` của
1 package luôn chạy đầu tiên khi có bất cứ thứ gì import từ package đó.

`worktracker_core/settings.py` — thêm ngay dưới khối `CACHES` (Redis db=1
dùng cho JWT blacklist, db=2 cho is_active cache — theo đúng convention
comment `# db=X: ...` đã có sẵn trong file):
```python
# db=3: Celery message broker — separate from blacklist (db=1) and is_active cache (db=2).
CELERY_BROKER_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/3"
CELERY_RESULT_BACKEND = f"redis://{REDIS_HOST}:{REDIS_PORT}/3"
```

Tên biến bắt buộc tiền tố `CELERY_` — `config_from_object(..., namespace="CELERY")`
ở trên chỉ đọc đúng những biến có tiền tố này.

## Giai đoạn 2 — Task "hello world" để test hạ tầng trước khi viết task thật

`system/tasks.py` (mới):
```python
from celery import shared_task


@shared_task
def ping():
    print("Celery is working!")
    return "pong"
```

`@shared_task` (không phải `@app.task`) vì đây là task khai báo trong 1 app
con — tránh phải import trực tiếp instance `app` từ `worktracker_core/celery.py`
vào từng app (né circular import). Tên file bắt buộc là `tasks.py` —
`app.autodiscover_tasks()` chỉ tự quét đúng tên file này trong từng app
được liệt kê ở `INSTALLED_APPS`.

## Lỗi thật #1 — Đặt sai tên file: `task.py` thay vì `tasks.py`

Gõ đúng nội dung code nhưng đặt tên file `system/task.py` (thiếu chữ "s").
Vì `autodiscover_tasks()` chỉ quét đúng tên `tasks.py`, Celery **không bao
giờ tìm thấy** task `ping`, dù nội dung code hoàn toàn đúng — không phải
lỗi cú pháp Python, mà là lỗi convention riêng của cơ chế discovery. Sửa:
đổi tên file qua Rename trong editor, không đổi nội dung.

## Lỗi thật #2 — Gõ code Python trực tiếp vào terminal (zsh)

Copy code mẫu (`@shared_task`, `def ping():`...) dán thẳng vào dòng lệnh
terminal thay vì vào file trong editor. zsh cố hiểu `@shared_task` như 1
lệnh shell → `zsh: command not found: @shared_task`; dấu `"` mở trong
`print("...")` khiến shell rơi vào trạng thái chờ đóng ngoặc kép
(prompt đổi thành `dquote>`), lặp `Ctrl+C` không thoát được vì `Ctrl+C`
trong Python REPL/shell chỉ hủy dòng đang gõ dở, không thoát chương trình
— phải gõ `exit()`.

**Bài học**: terminal chỉ chạy **lệnh** (`pip install`, `celery -A ...
worker`, `python manage.py ...`); nội dung `.py` luôn gõ trong file, không
gõ thẳng vào dòng lệnh.

## Phát hiện khi verify: message queue bền qua lần restart worker

Chuỗi sự kiện thật đã xảy ra:
1. Gọi `ping.delay()` từ `manage.py shell` lúc **chưa có worker nào chạy**
   (worker cũ đã tắt sau khi sửa lỗi tên file, chưa khởi động lại) → vẫn
   nhận được `<AsyncResult: 9bad8dbb-...>` bình thường — task được đẩy vào
   Redis db=3 thành công, không cần worker sống mới nhận được ID.
2. Sau đó khởi động 1 worker mới → log `[tasks]` liệt kê đúng
   `system.tasks.ping` → **ngay lập tức** nhận và chạy đúng task với ID
   `9bad8dbb-...` từ bước 1 — không cần gọi `.delay()` lại lần nữa.

Kết luận: task nằm chờ **bền vững trong Redis** cho tới khi có worker tiêu
thụ, không mất dù worker sinh sau khi task được gửi. Đây là lý do "gọi task
mà không thấy gì xảy ra" ở lần thử đầu không phải lỗi hệ thống — chỉ đơn
giản là chưa có worker nào đang lắng nghe hàng đợi lúc đó.

## Verify

Log worker cuối cùng xác nhận:
```
[tasks]
  . system.tasks.ping
...
Task system.tasks.ping[9bad8dbb-25f0-47e2-b470-f4499a9a7225] received
Celery is working!
Task system.tasks.ping[9bad8dbb-25f0-47e2-b470-f4499a9a7225] succeeded in 0.0077s: 'pong'
```

Giai đoạn 1-2 pass. **Nợ lại**:
- Giai đoạn 3 — `send_notification_email_task` thật (nhận `notification_id`,
  `send_mail(...)`, `autoretry_for`/`retry_backoff` theo NFR-20, set
  `is_sent_email=True`/`sent_at` sau khi gửi).
- Giai đoạn 4 — bỏ comment tích hợp vào `enqueue_email_best_effort()`, test
  end-to-end qua `notify(..., channel=ALL)`.
