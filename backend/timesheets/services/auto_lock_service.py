"""
Tự động khoá kỳ công khi sang tháng mới (Quy trình 2 giai đoạn):

1. Giai đoạn 1 - Ngày 1 hàng tháng (Manager / Job Scope):
   - Tự động khoá cấp JOB cho tất cả các dự án thuộc kỳ công vừa kết thúc.
   - Mục đích: Chặn nhân viên (Employee) ghi hoặc sửa LogWork của tháng cũ.
   - Mở cửa sổ ân hạn (grace period) từ Ngày 1 đến hết Ngày 4 cho Manager
     rà soát, phê duyệt hoặc mở khoá có lý do nếu cần điều chỉnh.

2. Giai đoạn 2 - Ngày 5 hàng tháng (Admin / Global Scope):
   - Tự động khoá cấp GLOBAL cho toàn bộ hệ thống đối với kỳ công vừa kết thúc.
   - Mục đích: Hết hạn review của Manager, đóng băng hoàn toàn dữ liệu để
     bộ phận Kế toán / HR chốt bảng lương (payroll).

Tách phần lõi ra thành hàm thuần (không phụ thuộc Celery) vì ba lý do:
  - Test gọi thẳng được, không cần dựng worker.
  - Lệnh quản trị `autolock_previous_period` gọi lại chính hàm này, nên khi
    demo mà quên bật Celery beat thì vẫn chạy tay được.
  - Task Celery chỉ còn là lớp vỏ mỏng — chỗ dễ sai nhất (tính tháng trước,
    chống khoá nhầm tháng hiện tại) nằm ở đây và được test đầy đủ.
"""
import calendar
import logging
from datetime import date

from django.utils import timezone

from accounts.models import CustomUser
from projects.models import Job
from system.models import AuditLog, Notification
from system.services.audit_manager_service import log_action, snapshot
from system.services.notification_manager_service import notify
from timesheets.models import TimeLock
from timesheets.services.timelock_manager_service import (
    TimeLockError,
    get_job_timesheet_recipient_ids,
    lock_global_period,
)

logger = logging.getLogger(__name__)

AUTO_LOCK_JOB_REASON = (
    "Automatically locked by the system on Day 1 (Manager scope): "
    "the month ended and the timesheet period was closed for employee logging. "
    "Manager review window is open until Day 5."
)

AUTO_LOCK_GLOBAL_REASON = (
    "Automatically locked by the system on Day 5 (Admin scope): "
    "the grace review period ended and the timesheet period was closed "
    "globally for payroll."
)

# Giữ alias cũ cho tương thích ngược nếu có module khác tham chiếu
AUTO_LOCK_REASON = AUTO_LOCK_GLOBAL_REASON


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


def _auto_lock_jobs_for_period(month, year, today, actor):
    """
    Tự động khoá cấp JOB cho các dự án thuộc kỳ công (month, year).

    Kích hoạt từ Ngày 1 hàng tháng (today.day >= 1).
    Chỉ khoá các Job đã khởi chạy vào hoặc trước ngày cuối cùng của kỳ công.
    Tôn trọng việc Manager chủ động unlock trong khoảng thời gian từ ngày 1 đến ngày 4.
    """
    _, last_day = calendar.monthrange(year, month)
    period_end_date = date(year, month, last_day)

    jobs = Job.objects.filter(
        start_date__lte=period_end_date
    ).select_related("manager")

    locked_job_ids = []
    already_locked_count = 0
    skipped_unlocked_count = 0

    for job in jobs:
        existing_lock = (
            TimeLock.objects.filter(
                lock_scope=TimeLock.LockScope.JOB,
                job=job,
                lock_month=month,
                lock_year=year,
            )
            .first()
        )

        if existing_lock:
            if existing_lock.is_locked:
                already_locked_count += 1
                continue
            elif today.day < 5:
                # Manager đã chủ động mở khoá trong kỳ ân hạn (ngày 1 - 4)
                # Hệ thống không khoá đè lại để Manager tiếp tục xử lý.
                skipped_unlocked_count += 1
                continue
            else:
                # Từ ngày 5 trở đi: hết hạn ân hạn, khoá lại toàn bộ
                old_values = snapshot(existing_lock)
                existing_lock.is_locked = True
                existing_lock.locked_by = actor
                existing_lock.locked_at = timezone.now()
                existing_lock.lock_reason = AUTO_LOCK_JOB_REASON
                existing_lock.unlocked_by = None
                existing_lock.unlocked_at = None
                existing_lock.unlock_reason = None
                existing_lock.save(
                    update_fields=[
                        "is_locked",
                        "locked_by",
                        "locked_at",
                        "lock_reason",
                        "unlocked_by",
                        "unlocked_at",
                        "unlock_reason",
                        "updated_at",
                    ]
                )
                locked_job_ids.append(job.id)
                try:
                    log_action(
                        user=actor,
                        action="LOCK_TIMESHEET",
                        table_name="time_locks",
                        record_id=existing_lock.id,
                        old_values=old_values,
                        new_values=snapshot(existing_lock),
                        severity=AuditLog.Severity.INFO,
                        summary=f"System auto-locked period {month:02d}/{year} on Day 5 for job '{job.job_name}'.",
                    )
                except Exception:
                    pass
                continue

        # Tạo mới bản ghi TimeLock cấp JOB
        lock_user = job.manager if (job.manager and job.manager.is_active) else actor
        time_lock = TimeLock.objects.create(
            lock_month=month,
            lock_year=year,
            lock_scope=TimeLock.LockScope.JOB,
            job=job,
            is_locked=True,
            locked_by=lock_user,
            locked_at=timezone.now(),
            lock_reason=AUTO_LOCK_JOB_REASON,
        )
        locked_job_ids.append(job.id)

        try:
            log_action(
                user=lock_user,
                action="LOCK_TIMESHEET",
                table_name="time_locks",
                record_id=time_lock.id,
                old_values=None,
                new_values=snapshot(time_lock),
                severity=AuditLog.Severity.INFO,
                summary=f"System auto-locked period {month:02d}/{year} on Day 1 for job '{job.job_name}'.",
            )
            notify(
                recipients=get_job_timesheet_recipient_ids(job),
                event_type=Notification.EventType.TIMESHEET_LOCK,
                title="Timesheet period locked",
                content=f"Timesheet period {month}/{year} has been automatically locked for job: {job.job_name}",
                related_url="/manager/timelock",
                channel=Notification.ChannelType.SYSTEM_ONLY,
            )
        except Exception:
            pass

    return {
        "total_jobs": jobs.count(),
        "locked_count": len(locked_job_ids),
        "already_locked_count": already_locked_count,
        "skipped_unlocked_count": skipped_unlocked_count,
        "locked_job_ids": locked_job_ids,
    }


def _auto_lock_global_for_period(month, year, today, actor):
    """
    Tự động khoá cấp GLOBAL cho toàn hệ thống kỳ công (month, year).

    Chỉ kích hoạt từ Ngày 5 hàng tháng (today.day >= 5) để dành 4 ngày đầu
    cho Manager review/duyệt công.
    """
    if today.day < 5:
        logger.info(
            "[AutoLock] Hom nay la ngay %d/%d, chua den ngay 5. "
            "Chua khoa GLOBAL ky %02d/%d de Manager tiep tuc review.",
            today.day, today.month, month, year,
        )
        return {
            "status": "pending_until_day_5",
            "month": month,
            "year": year,
            "current_day": today.day,
        }

    da_khoa = TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        job__isnull=True,
        lock_month=month,
        lock_year=year,
        is_locked=True,
    ).exists()
    if da_khoa:
        logger.info("[AutoLock] Ky GLOBAL %02d/%d da khoa tu truoc, bo qua.", month, year)
        return {"status": "already_locked", "month": month, "year": year}

    try:
        lock_global_period(
            user=actor,
            lock_month=month,
            lock_year=year,
            reason=AUTO_LOCK_GLOBAL_REASON,
        )
    except TimeLockError as exc:
        logger.info("[AutoLock] Ky GLOBAL %02d/%d: %s", month, year, exc)
        return {"status": "already_locked", "month": month, "year": year}
    except Exception as exc:
        logger.exception("[AutoLock] Khoa GLOBAL ky %02d/%d that bai: %s", month, year, exc)
        return {"status": "error", "month": month, "year": year, "reason": str(exc)}

    logger.info(
        "[AutoLock] Da khoa GLOBAL ky %02d/%d, dung ten %s.", month, year, actor.email
    )
    return {"status": "locked", "month": month, "year": year, "actor": actor.email}


def auto_lock_previous_period(today=None):
    """
    Khoá kỳ công của tháng vừa kết thúc theo cơ chế 2 giai đoạn:
      - Ngày 1: Tự động khoá cấp JOB (Manager scope).
      - Ngày 5: Tự động khoá cấp GLOBAL (Admin scope).

    Trả về dict mô tả chi tiết:
      {
        "status": "locked" | "already_locked" | "no_admin" | "error",
        "month": month,
        "year": year,
        "actor": actor.email,
        "job_locks": { ... },
        "global_lock": { ... },
      }
    """
    today = today or timezone.localdate()
    month, year = get_previous_period(today)

    # Chốt chặn quan trọng nhất: không bao giờ đụng tới tháng đang diễn ra / tương lai
    if (year, month) >= (today.year, today.month):
        logger.error(
            "[AutoLock] Tu choi khoa ky %02d/%d vi no khong phai thang da qua "
            "(hom nay %s).", month, year, today
        )
        return {"status": "error", "month": month, "year": year, "reason": "not_a_past_period"}

    actor = _get_system_actor()
    if actor is None:
        logger.error(
            "[AutoLock] Khong tim thay Admin dang hoat dong nao de dung ten "
            "khoa ky %02d/%d.", month, year
        )
        return {"status": "no_admin", "month": month, "year": year}

    # 1. Khóa cấp JOB (từ Ngày 1)
    job_result = _auto_lock_jobs_for_period(month, year, today, actor)

    # 2. Khóa cấp GLOBAL (từ Ngày 5)
    global_result = _auto_lock_global_for_period(month, year, today, actor)

    # Tính status tổng quát
    if today.day >= 5:
        overall_status = global_result.get("status", "error")
    else:
        if job_result["locked_count"] > 0:
            overall_status = "locked"
        else:
            overall_status = "already_locked"

    return {
        "status": overall_status,
        "month": month,
        "year": year,
        "actor": actor.email,
        "job_locks": job_result,
        "global_lock": global_result,
    }

