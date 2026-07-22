import os
from celery import Celery

# Đặt module settings mặc định cho chương trình 'celery'
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worktracker_core.settings")

app = Celery("worktracker_core")

# Đọc cấu hình từ settings.py, chỉ lấy các key bắt đầu bằng CELERY_
app.config_from_object("django.conf:settings", namespace="CELERY")

# Tự động tìm kiếm task trong tất cả INSTALLED_APPS
# (Tìm file `tasks.py` trong mỗi app)
app.autodiscover_tasks()
