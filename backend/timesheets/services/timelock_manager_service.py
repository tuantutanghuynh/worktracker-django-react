"""
Module: timesheets.services.timelock_manager_service
Description: Service functions for managing global and job-level period locking, unlocking, and status validation.
"""

import calendar
from datetime import date
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from tasks.models import Task
from timesheets.models import TimeLock
from system.models import AuditLog, Notification
from system.services.audit_manager_service import snapshot, log_action
from system.services.notification_manager_service import notify


class TimeLockError(APIException):
    """Exception raised when a time-lock action violates period validation rules."""
    status_code = 400
    default_detail = "Time lock rule violation."
    default_code = "time_lock_error"


def get_period_from_date(work_date):
    """Extract month and year integers from a date instance."""
    return work_date.month, work_date.year


def assert_job_in_manager_scope(user, job):
    """Validate that the job is managed by the user or raise PermissionDenied."""
    if job.manager_id != user.id:
        raise PermissionDenied("JOB_OUT_OF_MANAGER_SCOPE")


def validate_month_year(lock_month, lock_year):
    """Validate that month is between 1 and 12 and year is valid."""
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
    """Check if the specified monthly period is locked globally by an administrator."""
    return TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        job__isnull=True,
        lock_month=lock_month,
        lock_year=lock_year,
        is_locked=True,
    ).exists()


def is_job_period_locked(job_id, lock_month, lock_year, today=None):
    """Check if the specified monthly period is locked for a specific job."""
    job_lock = (
        TimeLock.objects.filter(
            lock_scope=TimeLock.LockScope.JOB,
            job_id=job_id,
            lock_month=lock_month,
            lock_year=lock_year,
        )
        .order_by("-id")
        .first()
    )

    if job_lock is not None:
        return job_lock.is_locked

    return False


def is_period_locked(job_id, lock_month, lock_year, today=None):
    """Determine if a monthly period is locked under either global or job scope."""
    return (
        is_global_period_locked(lock_month, lock_year)
        or is_job_period_locked(job_id, lock_month, lock_year, today=today)
    )


def assert_period_open_for_job(job_id, work_date):
    """Validate that the monthly period for a given date and job is open for edits."""
    lock_month, lock_year = get_period_from_date(work_date)

    if is_global_period_locked(lock_month, lock_year):
        raise TimeLockError("GLOBAL_PERIOD_IS_LOCKED: This period is globally locked by Admin.")

    if is_job_period_locked(job_id, lock_month, lock_year):
        raise TimeLockError(f"JOB_PERIOD_IS_LOCKED: Period {lock_month}/{lock_year} is locked for this project.")


def get_job_timesheet_recipient_ids(job):
    """Retrieve distinct user IDs of assignees and manager associated with a job."""
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
    """Lock a completed monthly timesheet period for a specific project within manager scope."""
    assert_job_in_manager_scope(user, job)
    validate_month_year(lock_month, lock_year)

    _, last_day = calendar.monthrange(int(lock_year), int(lock_month))
    period_end_date = date(int(lock_year), int(lock_month), last_day)
    today = timezone.now().date()

    if today <= period_end_date:
        raise TimeLockError(
            f"CANNOT_LOCK_ACTIVE_PERIOD: Period {lock_month}/{lock_year} is currently in progress (ends on {period_end_date.strftime('%d/%m/%Y')}). "
            "You can only lock past completed periods."
        )

    if job.start_date and int(lock_year) < job.start_date.year:
        from timesheets.models import LogWork
        has_logs = LogWork.objects.filter(task__job=job, work_date__year=lock_year, work_date__month=lock_month).exists()
        if not has_logs:
            raise TimeLockError(
                f"CANNOT_LOCK_BEFORE_JOB_START: Project '{job.job_name}' started in {job.start_date.year}. "
                f"You cannot lock periods prior to project inception ({lock_month}/{lock_year})."
            )

    from timesheets.models import LogWork
    pending_count = LogWork.objects.filter(
        task__job=job,
        work_date__month=lock_month,
        work_date__year=lock_year,
        review_status=LogWork.ReviewStatus.PENDING,
    ).count()

    if pending_count > 0:
        raise TimeLockError(
            f"Cannot lock timesheet period {lock_month}/{lock_year} because there are {pending_count} pending work log(s). "
            "Please approve, reject, or void all pending logs before locking."
        )

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
            related_url="/manager/timelock",
            channel=Notification.ChannelType.SYSTEM_ONLY,
        )

    return time_lock


def get_global_timesheet_recipient_ids(exclude_user=None):
    """Retrieve distinct user IDs for all active administrators and managers."""
    from accounts.models import CustomUser

    recipient_ids = list(
        CustomUser.objects.filter(
            role__code__in=["ADMIN", "MANAGER"], is_active=True
        ).values_list("id", flat=True)
    )
    exclude_id = exclude_user.id if exclude_user else None
    return [uid for uid in recipient_ids if uid != exclude_id]


def lock_global_period(
    *,
    user,
    lock_month,
    lock_year,
    reason=None,
    request=None,
):
    """Lock a completed monthly timesheet period company-wide across all projects."""
    validate_month_year(lock_month, lock_year)

    _, last_day = calendar.monthrange(int(lock_year), int(lock_month))
    period_end_date = date(int(lock_year), int(lock_month), last_day)
    today = timezone.now().date()

    if today <= period_end_date:
        raise TimeLockError(
            f"CANNOT_LOCK_ACTIVE_PERIOD: Period {lock_month}/{lock_year} is currently in progress "
            f"(ends on {period_end_date.strftime('%d/%m/%Y')}). "
            "You can only lock past completed periods."
        )

    clean_reason = reason.strip() if isinstance(reason, str) else reason

    with transaction.atomic():
        existing_lock = (
            TimeLock.objects.select_for_update()
            .filter(
                lock_scope=TimeLock.LockScope.GLOBAL,
                job__isnull=True,
                lock_month=lock_month,
                lock_year=lock_year,
            )
            .first()
        )

        if existing_lock and existing_lock.is_locked:
            raise TimeLockError("GLOBAL_PERIOD_ALREADY_LOCKED")

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
                lock_scope=TimeLock.LockScope.GLOBAL,
                job=None,
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
            severity=AuditLog.Severity.WARNING,
            summary=f"Locked timesheet period {lock_month}/{lock_year} company-wide (GLOBAL).",
        )

        notify(
            recipients=get_global_timesheet_recipient_ids(exclude_user=user),
            event_type=Notification.EventType.TIMESHEET_LOCK,
            title="Timesheet period locked (company-wide)",
            content=f"{user.email} locked the timesheet period {lock_month}/{lock_year} for the whole system.",
            related_url="/admin/timesheets",
            channel=Notification.ChannelType.SYSTEM_ONLY,
        )

    return time_lock


def unlock_global_period(
    *,
    user,
    time_lock,
    reason,
    request=None,
):
    """Unlock a previously locked global period requiring a non-empty reason string."""
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
            .get(pk=time_lock.pk)
        )

        if locked_time_lock.lock_scope != TimeLock.LockScope.GLOBAL:
            raise PermissionDenied("ADMIN_CAN_ONLY_UNLOCK_GLOBAL_SCOPE")

        if not locked_time_lock.is_locked:
            raise TimeLockError("GLOBAL_PERIOD_ALREADY_UNLOCKED")

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
            severity=AuditLog.Severity.WARNING,
            summary=f"Unlocked timesheet period {locked_time_lock.lock_month}/{locked_time_lock.lock_year} company-wide (GLOBAL).",
        )

        notify(
            recipients=get_global_timesheet_recipient_ids(exclude_user=user),
            event_type=Notification.EventType.TIMESHEET_UNLOCK,
            title="Timesheet period unlocked (company-wide)",
            content=f"{user.email} unlocked the timesheet period {locked_time_lock.lock_month}/{locked_time_lock.lock_year} for the whole system.",
            related_url="/admin/timesheets",
            channel=Notification.ChannelType.SYSTEM_ONLY,
        )

    return locked_time_lock


def unlock_job_period(
    *,
    user,
    time_lock,
    reason,
    request=None,
):
    """Unlock a previously locked job-level period within manager scope requiring reason."""
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
            related_url="/manager/timelock",
            channel=Notification.ChannelType.SYSTEM_ONLY,
        )

    return locked_time_lock