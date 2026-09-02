"""
Celery task của app timesheets.

Cùng quy ước với system/tasks.py: dùng @shared_task để không phụ thuộc vào
một celery app cụ thể, và autodiscover_tasks() trong worktracker_core/celery.py
tự tìm file này.

Toàn bộ logic nằm ở services/auto_lock_service.py — file này chỉ là lớp vỏ
để Celery gọi được.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="timesheets.auto_lock_previous_period")
def auto_lock_previous_period_task():
    """
    Chạy mỗi ngày (xem CELERY_BEAT_SCHEDULE trong settings.py).

    Không đặt retry: hàm lõi đã tự bắt mọi ngoại lệ và trả về dict trạng
    thái, nên task này không bao giờ ném lỗi để mà phải thử lại. Nếu hôm nay
    lỡ trượt thì lần chạy ngày mai vẫn khoá được — kỳ đã qua không tự mở lại.
    """
    from timesheets.services.auto_lock_service import auto_lock_previous_period

    ket_qua = auto_lock_previous_period()
    logger.info("[Celery] auto_lock_previous_period -> %s", ket_qua)
    return ket_qua
