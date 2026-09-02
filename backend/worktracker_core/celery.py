import os
import redis
from celery import Celery

# Tương thích với máy chủ Redis trên Windows: Ép sử dụng RESP2 protocol
# tránh lỗi `unknown command HELLO` khi redis-py 5.x+ bắt tay kết nối.
_orig_redis_conn_init = redis.Connection.__init__
def _patched_redis_conn_init(self, *args, **kwargs):
    kwargs.setdefault("protocol", 2)
    kwargs["maint_notifications_config"] = None
    _orig_redis_conn_init(self, *args, **kwargs)
redis.Connection.__init__ = _patched_redis_conn_init

# Đặt module settings mặc định cho chương trình 'celery'
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worktracker_core.settings")

app = Celery("worktracker_core")

# Đọc cấu hình từ settings.py, chỉ lấy các key bắt đầu bằng CELERY_
app.config_from_object("django.conf:settings", namespace="CELERY")

# Tự động tìm kiếm task trong tất cả INSTALLED_APPS
# (Tìm file `tasks.py` trong mỗi app)
app.autodiscover_tasks()
