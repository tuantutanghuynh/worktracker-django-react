from decimal import Decimal

from django.db.models import Sum

from timesheets.models import LogWork, TimeLock
from system.scoping_manager import scoped_logworks


def decimal_to_float(value):
    if value is None:
        return 0.0

    if isinstance(value, Decimal):
        return float(value)

    return value


def user_display_name(user):
    if user is None:
        return None

    profile = getattr(user, "profile", None)

    if profile and profile.full_name:
        return profile.full_name

    return user.email


def apply_timesheet_detail_filters(queryset, filters):
    work_date_from = filters.get("work_date_from")
    work_date_to = filters.get("work_date_to")
    employee_id = filters.get("employee_id")
    department_id = filters.get("department_id")
    job_id = filters.get("job_id")
    task_id = filters.get("task_id")
    task_status = filters.get("task_status")
    review_status = filters.get("review_status")
    include_voided = filters.get("include_voided", False)

    if not include_voided:
        queryset = queryset.exclude(
            review_status=LogWork.ReviewStatus.VOIDED,
        )

    if work_date_from:
        queryset = queryset.filter(work_date__gte=work_date_from)

    if work_date_to:
        queryset = queryset.filter(work_date__lte=work_date_to)

    if employee_id:
        queryset = queryset.filter(user_id=employee_id)

    if department_id:
        queryset = queryset.filter(
            user__profile__department_id=department_id,
        )

    if job_id:
        queryset = queryset.filter(task__job_id=job_id)

    if task_id:
        queryset = queryset.filter(task_id=task_id)

    if task_status:
        queryset = queryset.filter(task__status=task_status)

    if review_status:
        queryset = queryset.filter(review_status=review_status)

    return queryset


def collect_period_keys(logworks):
    """
    Lấy bộ khóa:
        (job_id, month, year)

    Dùng để kiểm tra locked/unlocked cho từng LogWork.
    """
    keys = set()

    for logwork in logworks:
        keys.add(
            (
                logwork.task.job_id,
                logwork.work_date.month,
                logwork.work_date.year,
            )
        )

    return keys


def build_locked_period_map(period_keys):
    """
    Trả về map:
        (job_id, month, year) -> True/False

    Một kỳ bị xem là locked nếu:
    - Có GLOBAL lock tháng/năm.
    - Hoặc có JOB lock đúng job/tháng/năm.
    """
    if not period_keys:
        return {}

    months = {
        month
        for job_id, month, year in period_keys
    }

    years = {
        year
        for job_id, month, year in period_keys
    }

    job_ids = {
        job_id
        for job_id, month, year in period_keys
    }

    global_locks = TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.GLOBAL,
        job__isnull=True,
        is_locked=True,
        lock_month__in=months,
        lock_year__in=years,
    ).values_list(
        "lock_month",
        "lock_year",
    )

    global_locked_keys = set(global_locks)

    job_locks = TimeLock.objects.filter(
        lock_scope=TimeLock.LockScope.JOB,
        job_id__in=job_ids,
        is_locked=True,
        lock_month__in=months,
        lock_year__in=years,
    ).values_list(
        "job_id",
        "lock_month",
        "lock_year",
    )

    job_locked_keys = set(job_locks)

    result = {}

    for job_id, month, year in period_keys:
        result[(job_id, month, year)] = (
            (month, year) in global_locked_keys
            or (job_id, month, year) in job_locked_keys
        )

    return result


def apply_locked_period_filter(logworks, locked_period_status):
    if not locked_period_status:
        return logworks

    period_keys = collect_period_keys(logworks)
    locked_map = build_locked_period_map(period_keys)

    result = []

    for logwork in logworks:
        key = (
            logwork.task.job_id,
            logwork.work_date.month,
            logwork.work_date.year,
        )

        is_locked = locked_map.get(key, False)

        if locked_period_status == "LOCKED" and is_locked:
            result.append(logwork)

        if locked_period_status == "UNLOCKED" and not is_locked:
            result.append(logwork)

    return result


def build_review_status_summary(logworks):
    summary = {
        status_value: 0
        for status_value, status_label in LogWork.ReviewStatus.choices
    }

    for logwork in logworks:
        summary[logwork.review_status] += 1

    return summary


def build_employee_summary(logworks):
    data = {}

    for logwork in logworks:
        user_id = logwork.user_id

        if user_id not in data:
            data[user_id] = {
                "user_id": user_id,
                "email": logwork.user.email,
                "full_name": user_display_name(logwork.user),
                "total_logs": 0,
                "total_hours": Decimal("0.00"),
            }

        data[user_id]["total_logs"] += 1
        data[user_id]["total_hours"] += logwork.hours_spent

    result = []

    for row in data.values():
        result.append(
            {
                "user_id": row["user_id"],
                "email": row["email"],
                "full_name": row["full_name"],
                "total_logs": row["total_logs"],
                "total_hours": decimal_to_float(row["total_hours"]),
            }
        )

    return result


def build_job_summary(logworks):
    data = {}

    for logwork in logworks:
        job = logwork.task.job
        job_id = job.id

        if job_id not in data:
            data[job_id] = {
                "job_id": job_id,
                "job_name": job.job_name,
                "total_logs": 0,
                "total_hours": Decimal("0.00"),
            }

        data[job_id]["total_logs"] += 1
        data[job_id]["total_hours"] += logwork.hours_spent

    result = []

    for row in data.values():
        result.append(
            {
                "job_id": row["job_id"],
                "job_name": row["job_name"],
                "total_logs": row["total_logs"],
                "total_hours": decimal_to_float(row["total_hours"]),
            }
        )

    return result


def serialize_logwork_row(logwork, locked_map):
    job = logwork.task.job
    period_key = (
        job.id,
        logwork.work_date.month,
        logwork.work_date.year,
    )

    is_locked = locked_map.get(period_key, False)

    department = getattr(
        getattr(logwork.user, "profile", None),
        "department",
        None,
    )

    return {
        "id": logwork.id,
        "work_date": logwork.work_date,
        "hours_spent": decimal_to_float(logwork.hours_spent),
        "description": logwork.description,
        "review_status": logwork.review_status,
        "reviewed_at": logwork.reviewed_at,
        "reviewed_note": logwork.reviewed_note,
        "adjusted_at": logwork.adjusted_at,
        "adjustment_reason": logwork.adjustment_reason,
        "created_at": logwork.created_at,
        "updated_at": logwork.updated_at,
        "locked_period_status": "LOCKED" if is_locked else "UNLOCKED",
        "employee": {
            "id": logwork.user_id,
            "email": logwork.user.email,
            "full_name": user_display_name(logwork.user),
            "department": {
                "id": department.id,
                "name": department.name,
            } if department else None,
        },
        "task": {
            "id": logwork.task_id,
            "title": logwork.task.title,
            "status": logwork.task.status,
            "deadline": logwork.task.deadline,
        },
        "job": {
            "id": job.id,
            "job_name": job.job_name,
            "status": job.status,
            "deadline": job.deadline,
        },
        "reviewed_by": {
            "id": logwork.reviewed_by_id,
            "email": logwork.reviewed_by.email,
            "full_name": user_display_name(logwork.reviewed_by),
        } if logwork.reviewed_by else None,
        "adjusted_by": {
            "id": logwork.adjusted_by_id,
            "email": logwork.adjusted_by.email,
            "full_name": user_display_name(logwork.adjusted_by),
        } if logwork.adjusted_by else None,
    }


def build_timesheet_detail_report(*, user, filters):
    """
    Manager Timesheet Detail Report.

    Scope bắt buộc:
        logwork.task.job.manager_id = request.user.id

    Report này chỉ đọc dữ liệu, không ghi dữ liệu nghiệp vụ.
    """
    base_queryset = (
        scoped_logworks(user)
        .select_related(
            "task",
            "task__job",
            "user",
            "user__profile",
            "user__profile__department",
            "reviewed_by",
            "reviewed_by__profile",
            "adjusted_by",
            "adjusted_by__profile",
        )
    )

    filtered_queryset = apply_timesheet_detail_filters(
        base_queryset,
        filters,
    ).order_by(
        "-work_date",
        "user__email",
        "task__job__job_name",
        "task__title",
    )

    logworks = list(filtered_queryset)

    logworks = apply_locked_period_filter(
        logworks,
        filters.get("locked_period_status"),
    )

    period_keys = collect_period_keys(logworks)
    locked_map = build_locked_period_map(period_keys)

    total_hours = sum(
        (
            logwork.hours_spent
            for logwork in logworks
        ),
        Decimal("0.00"),
    )

    return {
        "filters": dict(filters),
        "summary": {
            "total_logs": len(logworks),
            "total_hours": decimal_to_float(total_hours),
            "review_status_summary": build_review_status_summary(logworks),
            "employee_summary": build_employee_summary(logworks),
            "job_summary": build_job_summary(logworks),
        },
        "rows": [
            serialize_logwork_row(logwork, locked_map)
            for logwork in logworks
        ],
    }