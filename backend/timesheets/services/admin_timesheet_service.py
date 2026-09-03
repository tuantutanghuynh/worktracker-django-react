"""
Module: timesheets.services.admin_timesheet_service
Description: Aggregated metrics calculation and compliance auditing for company-wide timesheet administration.
"""

from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Q, Sum, Max
from django.utils import timezone

from accounts.models import CustomUser, EmployeeProfile
from timesheets.models import DailyUserTimesheet, LogWork, TimeLock
from timesheets.services.manager_employee_utilization_service import calculate_working_days


def decimal_to_float(value):
    """Convert decimal instances to float representation safely."""
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return value


def get_month_range(month, year):
    """Return start date and end date for a given month and year."""
    start_date = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end_date = date(year, month, last_day)
    return start_date, end_date


def _daily_working_hours():
    """Retrieve standard daily working hours from Django settings."""
    return getattr(settings, "DAILY_WORKING_HOURS", 8)


def _warning_threshold():
    """Retrieve configured ratio threshold before flagging timesheet hours as warning."""
    return getattr(settings, "TIMESHEET_WARNING_THRESHOLD", 0.8)


def get_elapsed_working_days(start_date, end_date, joined_date=None):
    """Calculate actual elapsed working days up to current date accounting for joined date."""
    today = timezone.now().date()
    if today < start_date:
        return 0

    effective_start = start_date
    if joined_date and joined_date > start_date:
        effective_start = joined_date

    effective_end = min(end_date, today)
    if effective_start > effective_end:
        return 0
    return calculate_working_days(effective_start, effective_end)


def get_admin_timesheet_summary(month, year):
    """Calculate summary KPI indicators across all active employees for administration control."""
    start_date, end_date = get_month_range(month, year)
    daily_hours = _daily_working_hours()

    employee_ids = list(
        CustomUser.objects.filter(role__code="EMPLOYEE", is_active=True)
        .filter(Q(profile__joined_date__isnull=True) | Q(profile__joined_date__lte=end_date))
        .values_list("id", flat=True)
    )

    logs_in_range = LogWork.objects.filter(
        user_id__in=employee_ids,
        work_date__range=(start_date, end_date),
    ).exclude(review_status=LogWork.ReviewStatus.VOIDED)

    total_logged_hours = decimal_to_float(logs_in_range.aggregate(total=Sum("hours_spent"))["total"])
    active_employees = logs_in_range.values("user_id").distinct().count()
    locked_periods_count = TimeLock.objects.filter(is_locked=True).count()

    timesheet_violations = DailyUserTimesheet.objects.filter(
        user_id__in=employee_ids,
        work_date__range=(start_date, end_date),
        total_hours__gt=daily_hours,
    ).count()

    elapsed_working_days = get_elapsed_working_days(start_date, end_date)
    logged_days_by_user = dict(
        DailyUserTimesheet.objects.filter(
            user_id__in=employee_ids,
            work_date__range=(start_date, end_date),
            total_hours__gt=0,
        )
        .values("user_id")
        .annotate(days=Count("id"))
        .values_list("user_id", "days")
    )
    joined_by_user = dict(
        EmployeeProfile.objects.filter(user_id__in=employee_ids)
        .values_list("user_id", "joined_date")
    )
    missing_timesheets = 0
    for uid in employee_ids:
        joined = joined_by_user.get(uid)
        days = (
            get_elapsed_working_days(start_date, end_date, joined)
            if joined
            else elapsed_working_days
        )
        missing_timesheets += max(days - logged_days_by_user.get(uid, 0), 0)

    return {
        "total_logged_hours": round(total_logged_hours, 1),
        "active_employees": active_employees,
        "locked_periods_count": locked_periods_count,
        "timesheet_violations": timesheet_violations,
        "missing_timesheets": missing_timesheets,
    }


def get_admin_employee_timesheet_list(month, year, department_id=None, manager_id=None, search=None):
    """Retrieve high-performance employee timesheet compliance table using grouped aggregations."""
    start_date, end_date = get_month_range(month, year)
    daily_hours = _daily_working_hours()

    working_days = calculate_working_days(start_date, end_date)
    target_hours = working_days * daily_hours
    elapsed_working_days = get_elapsed_working_days(start_date, end_date)

    employees = CustomUser.objects.filter(role__code="EMPLOYEE", is_active=True).select_related(
        "profile", "profile__department"
    )
    employees = employees.filter(
        Q(profile__joined_date__isnull=True) | Q(profile__joined_date__lte=end_date)
    )
    if department_id:
        employees = employees.filter(profile__department_id=department_id)
    if manager_id:
        employees = employees.filter(profile__department__manager_id=manager_id)
    if search:
        employees = employees.filter(Q(email__icontains=search) | Q(profile__full_name__icontains=search))
    employees = employees.order_by("profile__full_name", "email")

    employee_ids = list(employees.values_list("id", flat=True))

    hours_by_user = dict(
        LogWork.objects.filter(user_id__in=employee_ids, work_date__range=(start_date, end_date))
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .values("user_id")
        .annotate(total=Sum("hours_spent"))
        .values_list("user_id", "total")
    )
    elapsed_end = min(end_date, timezone.now().date())
    hours_to_date_by_user = dict(
        LogWork.objects.filter(user_id__in=employee_ids, work_date__range=(start_date, elapsed_end))
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .values("user_id")
        .annotate(total=Sum("hours_spent"))
        .values_list("user_id", "total")
    ) if elapsed_end >= start_date else {}
    last_entry_by_user = dict(
        LogWork.objects.filter(user_id__in=employee_ids, work_date__range=(start_date, end_date))
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .values("user_id")
        .annotate(last_date=Max("work_date"))
        .values_list("user_id", "last_date")
    )
    violations_by_user = dict(
        DailyUserTimesheet.objects.filter(
            user_id__in=employee_ids, work_date__range=(start_date, end_date), total_hours__gt=daily_hours
        )
        .values("user_id")
        .annotate(count=Count("id"))
        .values_list("user_id", "count")
    )
    logged_days_by_user = dict(
        DailyUserTimesheet.objects.filter(
            user_id__in=employee_ids, work_date__range=(start_date, end_date), total_hours__gt=0
        )
        .values("user_id")
        .annotate(days=Count("id"))
        .values_list("user_id", "days")
    )

    results = []
    for emp in employees:
        profile = getattr(emp, "profile", None)
        logged_hours = decimal_to_float(hours_by_user.get(emp.id))
        logged_hours_to_date = decimal_to_float(hours_to_date_by_user.get(emp.id))
        violations = violations_by_user.get(emp.id, 0)

        joined_date = profile.joined_date if profile else None
        emp_elapsed_days = (
            get_elapsed_working_days(start_date, end_date, joined_date)
            if joined_date
            else elapsed_working_days
        )
        emp_expected_hours = emp_elapsed_days * daily_hours

        missing_days = max(emp_elapsed_days - logged_days_by_user.get(emp.id, 0), 0)

        if violations > 0:
            status = "OVER_LIMIT"
        elif missing_days > 0:
            status = "MISSING"
        elif emp_expected_hours > 0 and logged_hours < emp_expected_hours * _warning_threshold():
            status = "WARNING"
        else:
            status = "NORMAL"

        results.append(
            {
                "user_id": emp.id,
                "full_name": profile.full_name if (profile and profile.full_name) else emp.email,
                "email": emp.email,
                "department_id": profile.department_id if profile else None,
                "department_name": profile.department.name if (profile and profile.department) else None,
                "month_hours": round(logged_hours, 2),
                "target_hours": float(target_hours),
                "avg_per_day": (
                    round(logged_hours_to_date / emp_elapsed_days, 2)
                    if emp_elapsed_days
                    else 0.0
                ),
                "violations": violations,
                "missing_days": missing_days,
                "status": status,
                "last_entry": last_entry_by_user.get(emp.id),
            }
        )

    return results


def get_admin_employee_timesheet_detail(user_id, month, year):
    """Retrieve detailed compliance breakdown and period lock state for a specific employee."""
    start_date, end_date = get_month_range(month, year)
    daily_hours = _daily_working_hours()
    working_days = calculate_working_days(start_date, end_date)
    joined_date = (
        EmployeeProfile.objects.filter(user_id=user_id)
        .values_list("joined_date", flat=True)
        .first()
    )
    elapsed_working_days = get_elapsed_working_days(start_date, end_date, joined_date)

    logs_in_range = LogWork.objects.filter(user_id=user_id, work_date__range=(start_date, end_date)).exclude(
        review_status=LogWork.ReviewStatus.VOIDED
    )
    month_hours = decimal_to_float(logs_in_range.aggregate(total=Sum("hours_spent"))["total"])
    edited_records = logs_in_range.filter(adjusted_by__isnull=False).count()

    elapsed_end = min(end_date, timezone.now().date())
    hours_to_date = (
        decimal_to_float(
            logs_in_range.filter(work_date__lte=elapsed_end).aggregate(total=Sum("hours_spent"))["total"]
        )
        if elapsed_end >= start_date
        else 0.0
    )

    daily_over_limit = DailyUserTimesheet.objects.filter(
        user_id=user_id, work_date__range=(start_date, end_date), total_hours__gt=daily_hours
    ).count()
    daily_hard_limit = DailyUserTimesheet.objects.filter(
        user_id=user_id, work_date__range=(start_date, end_date), total_hours__gte=24
    ).count()

    logged_days = DailyUserTimesheet.objects.filter(
        user_id=user_id, work_date__range=(start_date, end_date), total_hours__gt=0
    ).count()
    missing_days = max(elapsed_working_days - logged_days, 0)

    global_lock = TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL, job__isnull=True, lock_month=month, lock_year=year
    ).select_related("locked_by", "unlocked_by").first()

    locked_period_edits = 0
    if global_lock and global_lock.locked_at:
        locked_period_edits = logs_in_range.filter(updated_at__gt=global_lock.locked_at).count()

    return {
        "month_hours": round(month_hours, 2),
        "working_days": working_days,
        "elapsed_working_days": elapsed_working_days,
        "avg_per_day": (
            round(hours_to_date / elapsed_working_days, 2) if elapsed_working_days else 0.0
        ),
        "edited_records": edited_records,
        "daily_over_limit_count": daily_over_limit,
        "daily_hard_limit_count": daily_hard_limit,
        "locked_period_edits": locked_period_edits,
        "missing_days": missing_days,
        "global_lock": (
            {
                "id": global_lock.id,
                "is_locked": global_lock.is_locked,
                "locked_by": global_lock.locked_by.email if global_lock.locked_by else None,
                "locked_at": global_lock.locked_at,
                "lock_reason": global_lock.lock_reason,
                "unlocked_by": global_lock.unlocked_by.email if global_lock.unlocked_by else None,
                "unlocked_at": global_lock.unlocked_at,
                "unlock_reason": global_lock.unlock_reason,
            }
            if global_lock
            else None
        ),
    }
