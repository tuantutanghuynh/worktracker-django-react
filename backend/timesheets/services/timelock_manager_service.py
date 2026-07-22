from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from tasks.models import Task
from timesheets.models import TimeLock
from system.models import Notification
from system.services.audit_manager_service import snapshot, log_action
from system.services.notification_manager_service import notify


class TimeLockError(APIException):
    status_code = 400
    default_detail = "Time lock rule violation."
    default_code = "time_lock_error"


def get_period_from_date(work_date):
    return work_date.month, work_date.year


def assert_job_in_manager_scope(user, job):
    """
    Manager chỉ được lock/unlock Job do chính mình quản lý.
    """
    if job.manager_id != user.id:
        raise PermissionDenied("JOB_OUT_OF_MANAGER_SCOPE")


def validate_month_year(lock_month, lock_year):
    if lock_month is None:
        raise ValidationError(
            {
                "lock_month": "lock_month is required."
            }
        )

    if lock_year is None:
        raise ValidationError(
            {
                "lock_year": "lock_year is required."
            }
        )

    if not 1 <= int(lock_month) <= 12:
        raise ValidationError(
            {
                "lock_month": "lock_month must be between 1 and 12."
            }
        )

    if int(lock_year) < 2000:
        raise ValidationError(
            {
                "lock_year": "lock_year is invalid."
            }
        )


def is_global_period_locked(lock_month, lock_year):
    return TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        job__isnull=True,
        lock_month=lock_month,
        lock_year=lock_year,
        is_locked=True,
    ).exists()


def is_job_period_locked(job_id, lock_month, lock_year):
    return TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.JOB,
        job_id=job_id,
        lock_month=lock_month,
        lock_year=lock_year,
        is_locked=True,
    ).exists()


def is_period_locked(job_id, lock_month, lock_year):
    """
    Một kỳ bị khóa nếu:
    - Admin đã GLOBAL lock kỳ đó
    - hoặc Manager đã JOB lock kỳ đó
    """
    return (
        is_global_period_locked(lock_month, lock_year)
        or is_job_period_locked(job_id, lock_month, lock_year)
    )


def assert_period_open_for_job(job_id, work_date):
    """
    Dùng trước khi Manager review/correct/void LogWork.
    """
    lock_month, lock_year = get_period_from_date(work_date)

    if is_global_period_locked(lock_month, lock_year):
        raise TimeLockError("GLOBAL_PERIOD_IS_LOCKED")

    if is_job_period_locked(job_id, lock_month, lock_year):
        raise TimeLockError("JOB_PERIOD_IS_LOCKED")


def get_job_timesheet_recipient_ids(job):
    """
    Người nhận notification lock/unlock:
    - Manager của Job
    - Các assignee từng có task trong Job
    """
    assignee_ids = (
        Task.objects.filter(
            job=job,
            assignee__is_active=True,
        )
        .values_list("assignee_id", flat=True)
        .distinct()
    )

    recipient_ids = set(assignee_ids)
    recipient_ids.add(job.manager_id)

    return list(recipient_ids)


def lock_job_period(
    *,
    user,
    job,
    lock_month,
    lock_year,
    reason=None,
    request=None,
):
    """
    Manager lock kỳ công theo Job.

    Scope:
        TimeLock.LockScope.JOB
    """
    assert_job_in_manager_scope(user, job)
    validate_month_year(lock_month, lock_year)

    clean_reason = reason.strip() if isinstance(reason, str) else reason

    with transaction.atomic():
        existing_lock = (
            TimeLock.objects.select_for_update()
            .filter(
                lock_scope=TimeLock.LockScope.JOB,
                job=job,
                lock_month=lock_month,
                lock_year=lock_year,
            )
            .first()
        )

        if existing_lock and existing_lock.is_locked:
            raise TimeLockError("JOB_PERIOD_ALREADY_LOCKED")

        if existing_lock:
            old_values = snapshot(existing_lock)

            existing_lock.is_locked = True
            existing_lock.locked_by = user
            existing_lock.locked_at = timezone.now()
            existing_lock.lock_reason = clean_reason
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

            time_lock = existing_lock
        else:
            time_lock = TimeLock.objects.create(
                lock_month=lock_month,
                lock_year=lock_year,
                lock_scope=TimeLock.LockScope.JOB,
                job=job,
                is_locked=True,
                locked_by=user,
                locked_at=timezone.now(),
                lock_reason=clean_reason,
            )

            old_values = None

        log_action(
            user=user,
            action="LOCK_TIMESHEET",
            table_name="time_locks",
            record_id=time_lock.id,
            old_values=old_values,
            new_values=snapshot(time_lock),
            request=request,
        )

        notify(
            recipients=get_job_timesheet_recipient_ids(job),
            event_type=Notification.EventType.TIMESHEET_LOCK,
            title="Timesheet period locked",
            content=f"Timesheet period {lock_month}/{lock_year} has been locked for job: {job.job_name}",
            related_url=f"/manager/jobs/{job.id}/timesheets",
            channel=Notification.ChannelType.SYSTEM_ONLY,
        )

    return time_lock


def unlock_job_period(
    *,
    user,
    time_lock,
    reason,
    request=None,
):
    """
    Manager unlock kỳ công theo Job.

    Chỉ unlock được JOB lock thuộc Job do Manager đó quản lý.
    """
    if not reason or not str(reason).strip():
        raise ValidationError(
            {
                "reason": "Unlock reason is required."
            }
        )

    clean_reason = str(reason).strip()

    with transaction.atomic():
        locked_time_lock = (
            TimeLock.objects.select_for_update(of=("self",))
            .select_related("job")
            .get(pk=time_lock.pk)
        )

        if locked_time_lock.lock_scope != TimeLock.LockScope.JOB:
            raise PermissionDenied("MANAGER_CAN_ONLY_UNLOCK_JOB_SCOPE")

        assert_job_in_manager_scope(user, locked_time_lock.job)

        if not locked_time_lock.is_locked:
            raise TimeLockError("JOB_PERIOD_ALREADY_UNLOCKED")

        old_values = snapshot(locked_time_lock)

        locked_time_lock.is_locked = False
        locked_time_lock.unlocked_by = user
        locked_time_lock.unlocked_at = timezone.now()
        locked_time_lock.unlock_reason = clean_reason
        locked_time_lock.save(
            update_fields=[
                "is_locked",
                "unlocked_by",
                "unlocked_at",
                "unlock_reason",
                "updated_at",
            ]
        )

        log_action(
            user=user,
            action="UNLOCK_TIMESHEET",
            table_name="time_locks",
            record_id=locked_time_lock.id,
            old_values=old_values,
            new_values=snapshot(locked_time_lock),
            request=request,
        )

        notify(
            recipients=get_job_timesheet_recipient_ids(locked_time_lock.job),
            event_type=Notification.EventType.TIMESHEET_UNLOCK,
            title="Timesheet period unlocked",
            content=f"Timesheet period {locked_time_lock.lock_month}/{locked_time_lock.lock_year} has been unlocked for job: {locked_time_lock.job.job_name}",
            related_url=f"/manager/jobs/{locked_time_lock.job.id}/timesheets",
            channel=Notification.ChannelType.SYSTEM_ONLY,
        )

    return locked_time_lock