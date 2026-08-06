# Đảm bảo Celery app được load khi Django khởi động.
# Điều này cần thiết để @shared_task hoạt động đúng.
from .celery import app as celery_app

__all__ = ("celery_app",)
