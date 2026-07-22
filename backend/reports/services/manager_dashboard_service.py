from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum

from tasks.models import Task
from timesheets.models import LogWork
from system.security.scoping_manager import (
    scoped_jobs,
    scoped_tasks,
    scoped_logworks,
)


def decimal_to_float(value):
    if value is None:
        return 0.0

    if isinstance(value, Decimal):
        return float(value)

    return value


def get_month_range(month, year):
    start_date = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end_date = date(year, month, last_day)

    return start_date, end_date


def build_task_status_summary(user):
    """
    Đếm số Task theo status trong scope Manager.
    """
    raw_rows = (
        scoped_tasks(user)
        .values("status")
        .annotate(total=Count("id"))
        .order_by("status")
    )

    summary = {
        status_value: 0
        for status_value, status_label in Task.Status.choices
    }

    for row in raw_rows:
        summary[row["status"]] = row["total"]

    return summary


def build_overdue_task_rate(user):
    """
    Tỷ lệ task quá hạn.

    Chỉ tính task chưa terminal:
    - TODO
    - IN_PROGRESS
    - REVIEWING
    """
    today = date.today()

    active_tasks = scoped_tasks(user).exclude(
        status__in=[
            Task.Status.COMPLETED,
            Task.Status.CANCELLED,
        ]
    )

    total_active = active_tasks.count()

    overdue_count = active_tasks.filter(
        deadline__lt=today,
    ).count()

    if total_active == 0:
        rate = 0

    else:
        rate = round((overdue_count / total_active) * 100, 2)

    return {
        "total_active_tasks": total_active,
        "overdue_tasks": overdue_count,
        "overdue_rate_percent": rate,
    }


def build_team_total_hours(user, month, year):
    """
    Tổng giờ log work trong tháng/năm.

    VOIDED không tính vào dashboard.
    """
    start_date, end_date = get_month_range(month, year)

    total = (
        scoped_logworks(user)
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .filter(
            work_date__gte=start_date,
            work_date__lte=end_date,
        )
        .aggregate(total_hours=Sum("hours_spent"))
    )["total_hours"]

    return decimal_to_float(total)


def build_workload_per_employee(user, month, year):
    """
    So sánh workload theo Employee:
    - open_task_count
    - logged_hours trong tháng
    """
    start_date, end_date = get_month_range(month, year)

    task_rows = (
        scoped_tasks(user)
        .exclude(
            status__in=[
                Task.Status.COMPLETED,
                Task.Status.CANCELLED,
            ]
        )
        .values(
            "assignee_id",
            "assignee__email",
            "assignee__profile__full_name",
        )
        .annotate(open_task_count=Count("id"))
    )

    hours_rows = (
        scoped_logworks(user)
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .filter(
            work_date__gte=start_date,
            work_date__lte=end_date,
        )
        .values(
            "user_id",
            "user__email",
            "user__profile__full_name",
        )
        .annotate(logged_hours=Sum("hours_spent"))
    )

    data = {}

    for row in task_rows:
        user_id = row["assignee_id"]

        data[user_id] = {
            "user_id": user_id,
            "email": row["assignee__email"],
            "full_name": (
                row["assignee__profile__full_name"]
                or row["assignee__email"]
            ),
            "open_task_count": row["open_task_count"],
            "logged_hours": 0.0,
        }

    for row in hours_rows:
        user_id = row["user_id"]

        if user_id not in data:
            data[user_id] = {
                "user_id": user_id,
                "email": row["user__email"],
                "full_name": (
                    row["user__profile__full_name"]
                    or row["user__email"]
                ),
                "open_task_count": 0,
                "logged_hours": 0.0,
            }

        data[user_id]["logged_hours"] = decimal_to_float(
            row["logged_hours"]
        )

    return list(data.values())


def build_productivity_heatmap(user, month, year):
    """
    Heatmap đơn giản:
        employee x day = total hours

    Trả về dạng list để frontend dễ render.
    """
    start_date, end_date = get_month_range(month, year)

    rows = (
        scoped_logworks(user)
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .filter(
            work_date__gte=start_date,
            work_date__lte=end_date,
        )
        .values(
            "user_id",
            "user__email",
            "user__profile__full_name",
            "work_date",
        )
        .annotate(total_hours=Sum("hours_spent"))
        .order_by("user__email", "work_date")
    )

    return [
        {
            "user_id": row["user_id"],
            "email": row["user__email"],
            "full_name": (
                row["user__profile__full_name"]
                or row["user__email"]
            ),
            "work_date": row["work_date"],
            "total_hours": decimal_to_float(row["total_hours"]),
        }
        for row in rows
    ]


def build_dashboard(user, month, year):
    """
    Manager Dashboard.

    Toàn bộ dữ liệu lấy từ scoped_*.
    Không truy cập Task.objects.all(), Job.objects.all(), LogWork.objects.all()
    trong dashboard Manager.
    """
    managed_jobs_count = scoped_jobs(user).count()

    return {
        "month": month,
        "year": year,
        "managed_jobs_count": managed_jobs_count,
        "task_status_summary": build_task_status_summary(user),
        "overdue_task_rate": build_overdue_task_rate(user),
        "team_total_hours": build_team_total_hours(user, month, year),
        "workload_per_employee": build_workload_per_employee(
            user,
            month,
            year,
        ),
        "productivity_heatmap": build_productivity_heatmap(
            user,
            month,
            year,
        ),
    }