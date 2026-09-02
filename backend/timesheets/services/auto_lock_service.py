"""
Tự động khoá kỳ công khi sang tháng mới.

Tách phần lõi ra thành hàm thuần (không phụ thuộc Celery) vì ba lý do:
  - Test gọi thẳng được, không cần dựng worker.
  - Lệnh quản trị `autolock_previous_period` gọi lại chính hàm này, nên khi
    demo mà quên bật Celery beat thì vẫn chạy tay được.
  - Task Celery chỉ còn là lớp vỏ mỏng — chỗ dễ sai nhất (tính tháng trước,
    chống khoá nhầm tháng hiện tại) nằm ở đây và được test đầy đủ.
"""
import logging
from datetime import date

from django.utils import timezone

from accounts.models import CustomUser
from timesheets.models import TimeLock
from timesheets.services.timelock_manager_service import (
    TimeLockError,
    lock_global_period,
)

logger = logging.getLogger(__name__)

AUTO_LOCK_REASON = (
    "Automatically locked by the system: the month ended and the timesheet "
    "period was closed for payroll."
)


def get_previous_period(today=None):
    """
    Trả về (tháng, năm) của tháng LIỀN TRƯỚC tháng chứa `today`.

    Tách riêng để test được mốc giao năm — tháng 1 phải lùi về tháng 12 của
    năm trước, chỗ này rất dễ viết sai thành tháng 0.
    """
    today = today or timezone.localdate()
    if today.month == 1:
        return 12, today.year - 1
    return today.month - 1, today.year


def _get_system_actor():
    """
    Chọn tài khoản đứng tên cho lệnh khoá tự động.

    TimeLock.locked_by là NOT NULL nên bắt buộc phải có người. Lấy Admin
    đang hoạt động có id nhỏ nhất — ổn định giữa các lần chạy, không đổi
    ngẫu nhiên. Việc đây là lệnh tự động được nói rõ trong lock_reason.
    """
    return (
        CustomUser.objects.filter(role__code="ADMIN", is_active=True)
        .order_by("id")
        .first()
    )


def auto_lock_previous_period(today=None):
    """
    Khoá kỳ công của tháng vừa kết thúc.

    Trả về dict mô tả việc đã làm, để lệnh quản trị và task Celery cùng in
    ra được kết quả:
        {"status": "locked" | "already_locked" | "no_admin" | "error", ...}

    Ba điều được bảo đảm:
      1. CHỈ khoá tháng đã qua. Tháng hiện tại không bao giờ bị đụng tới —
         nhân viên vẫn đang chấm công cho nó.
      2. Chạy lại nhiều lần không sao (idempotent). Beat chạy mỗi ngày nên
         từ ngày 2 trở đi tháng trước đã bị khoá rồi; lần chạy sau chỉ ghi
         nhận "already_locked" chứ không lỗi.
      3. Không bao giờ ném ngoại lệ ra ngoài. Task nền chết lặng lẽ còn tệ
         hơn không có task, nên mọi lỗi đều được bắt và ghi log.
    """
    today = today or timezone.localdate()
    month, year = get_previous_period(today)

    # Chốt chặn thừa nhưng cố ý: nếu sau này ai đó sửa get_previous_period()
    # sai, dòng này chặn hậu quả nghiêm trọng nhất — khoá nhầm tháng đang
    # chấm công, khiến toàn công ty không log giờ được.
    if (year, month) >= (today.year, today.month):
        logger.error(
            "[AutoLock] Tu choi khoa ky %02d/%d vi no khong phai thang da qua "
            "(hom nay %s).", month, year, today
        )
        return {"status": "error", "month": month, "year": year, "reason": "not_a_past_period"}

    da_khoa = TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        job__isnull=True,
        lock_month=month,
        lock_year=year,
        is_locked=True,
    ).exists()
    if da_khoa:
        logger.info("[AutoLock] Ky %02d/%d da khoa tu truoc, bo qua.", month, year)
        return {"status": "already_locked", "month": month, "year": year}

    actor = _get_system_actor()
    if actor is None:
        logger.error(
            "[AutoLock] Khong tim thay Admin dang hoat dong nao de dung ten "
            "khoa ky %02d/%d.", month, year
        )
        return {"status": "no_admin", "month": month, "year": year}

    try:
        lock_global_period(
            user=actor,
            lock_month=month,
            lock_year=year,
            reason=AUTO_LOCK_REASON,
        )
    except TimeLockError as exc:
        # GLOBAL_PERIOD_ALREADY_LOCKED: hai tien trinh chay cung luc, mot
        # ben thang. Khong phai loi.
        logger.info("[AutoLock] Ky %02d/%d: %s", month, year, exc)
        return {"status": "already_locked", "month": month, "year": year}
    except Exception as exc:
        logger.exception("[AutoLock] Khoa ky %02d/%d that bai: %s", month, year, exc)
        return {"status": "error", "month": month, "year": year, "reason": str(exc)}

    logger.info(
        "[AutoLock] Da khoa ky %02d/%d, dung ten %s.", month, year, actor.email
    )
    return {"status": "locked", "month": month, "year": year, "actor": actor.email}
