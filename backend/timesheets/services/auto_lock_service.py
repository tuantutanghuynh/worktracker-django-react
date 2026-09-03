"""
Module: timesheets.services.auto_lock_service
Description: Service functions for executing scheduled two-phase monthly period locking routines.
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

AUTO_LOCK_REASON = AUTO_LOCK_GLOBAL_REASON


def get_previous_period(today=None):
    """Return month and year tuple of the month preceding the given date."""
    today = today or timezone.localdate()
    if today.month == 1:
        return 12, today.year - 1
    return today.month - 1, today.year


def _get_system_actor():
    """Retrieve active administrator user account designated for automated system actions."""
    return (
        CustomUser.objects.filter(role__code="ADMIN", is_active=True)
        .order_by("id")
        .first()
    )


def _auto_lock_jobs_for_period(month, year, today, actor):
    """Execute automated job-level time lock enforcement for projects in elapsed period."""
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
                skipped_unlocked_count += 1
                continue
            else:
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
    """Execute automated global-level time lock enforcement for whole system on Day 5."""
    if today.day < 5:
        logger.info(
            "[AutoLock] Day is %d/%d, before Day 5. "
            "Skipping GLOBAL lock for period %02d/%d to allow manager review.",
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
        logger.info("[AutoLock] GLOBAL period %02d/%d already locked, skipping.", month, year)
        return {"status": "already_locked", "month": month, "year": year}

    try:
        lock_global_period(
            user=actor,
            lock_month=month,
            lock_year=year,
            reason=AUTO_LOCK_GLOBAL_REASON,
        )
    except TimeLockError as exc:
        logger.info("[AutoLock] GLOBAL period %02d/%d: %s", month, year, exc)
        return {"status": "already_locked", "month": month, "year": year}
    except Exception as exc:
        logger.exception("[AutoLock] GLOBAL lock failed for %02d/%d: %s", month, year, exc)
        return {"status": "error", "month": month, "year": year, "reason": str(exc)}

    logger.info(
        "[AutoLock] GLOBAL period %02d/%d locked under actor %s.", month, year, actor.email
    )
    return {"status": "locked", "month": month, "year": year, "actor": actor.email}


def auto_lock_previous_period(today=None):
    """Enforce two-stage period locking on elapsed month across job and global scopes."""
    today = today or timezone.localdate()
    month, year = get_previous_period(today)

    if (year, month) >= (today.year, today.month):
        logger.error(
            "[AutoLock] Refusing to lock period %02d/%d as it is not a past period "
            "(today is %s).", month, year, today
        )
        return {"status": "error", "month": month, "year": year, "reason": "not_a_past_period"}

    actor = _get_system_actor()
    if actor is None:
        logger.error(
            "[AutoLock] No active Administrator found to execute auto-lock for period %02d/%d.",
            month, year
        )
        return {"status": "no_admin", "month": month, "year": year}

    job_result = _auto_lock_jobs_for_period(month, year, today, actor)
    global_result = _auto_lock_global_for_period(month, year, today, actor)

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
