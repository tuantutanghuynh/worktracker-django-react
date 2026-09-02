from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Q, Sum

from tasks.models import Task
from timesheets.models import LogWork
from system.security.scoping_manager import (
    scoped_jobs,
    scoped_tasks,
    scoped_logworks,
)
from timesheets.services.manager_employee_utilization_service import calculate_working_days


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


def build_task_metrics_summary(user):
    """
    TỐI ƯU HIỆU NĂNG:
    Gom 2 hàm build_task_status_summary và build_overdue_task_rate làm một,
    thực hiện ĐÚNG 1 CÂU QUERY SQL DUY NHẤT thay vì 3 câu SQL riêng lẻ.
    """
    today = date.today()
    active_condition = Q(
        status__in=[
            Task.Status.TODO,
            Task.Status.IN_PROGRESS,
            Task.Status.REVIEWING,
        ]
    )

    metrics = scoped_tasks(user).aggregate(
        todo=Count("id", filter=Q(status=Task.Status.TODO)),
        in_progress=Count("id", filter=Q(status=Task.Status.IN_PROGRESS)),
        reviewing=Count("id", filter=Q(status=Task.Status.REVIEWING)),
        completed=Count("id", filter=Q(status=Task.Status.COMPLETED)),
        cancelled=Count("id", filter=Q(status=Task.Status.CANCELLED)),
        total_active=Count("id", filter=active_condition),
        overdue=Count("id", filter=active_condition & Q(deadline__lt=today)),
    )

    status_summary = {
        Task.Status.TODO: metrics["todo"] or 0,
        Task.Status.IN_PROGRESS: metrics["in_progress"] or 0,
        Task.Status.REVIEWING: metrics["reviewing"] or 0,
        Task.Status.COMPLETED: metrics["completed"] or 0,
        Task.Status.CANCELLED: metrics["cancelled"] or 0,
    }

    total_active = metrics["total_active"] or 0
    overdue_count = metrics["overdue"] or 0
    rate = round((overdue_count / total_active) * 100, 2) if total_active > 0 else 0.0

    overdue_summary = {
        "total_active_tasks": total_active,
        "overdue_tasks": overdue_count,
        "overdue_rate_percent": rate,
    }

    return status_summary, overdue_summary


def build_team_hours_summary(user, month, year):
    """
    Thống kê tổng hợp giờ làm việc của team: Tổng giờ, Giờ đã duyệt (Approved),
    Giờ chờ duyệt (Pending), Giờ bị từ chối (Rejected).
    """
    start_date, end_date = get_month_range(month, year)

    qs = (
        scoped_logworks(user)
        .exclude(review_status=LogWork.ReviewStatus.VOIDED)
        .filter(
            work_date__gte=start_date,
            work_date__lte=end_date,
        )
    )

    result = qs.aggregate(
        total_hours=Sum("hours_spent"),
        approved_hours=Sum("hours_spent", filter=Q(review_status=LogWork.ReviewStatus.APPROVED)),
        pending_hours=Sum("hours_spent", filter=Q(review_status=LogWork.ReviewStatus.PENDING)),
        rejected_hours=Sum("hours_spent", filter=Q(review_status=LogWork.ReviewStatus.REJECTED)),
    )

    return {
        "team_total_hours": decimal_to_float(result["total_hours"]),
        "team_approved_hours": decimal_to_float(result["approved_hours"]),
        "team_pending_hours": decimal_to_float(result["pending_hours"]),
        "team_rejected_hours": decimal_to_float(result["rejected_hours"]),
    }


def build_team_total_hours(user, month, year):
    """
    Tổng giờ log work trong tháng/năm.
    VOIDED không tính vào dashboard.
    """
    return build_team_hours_summary(user, month, year)["team_total_hours"]


def build_pending_timesheets_count(user):
    """
    Đếm số ngày công (user_id, work_date) đang chờ duyệt của Manager.
    """
    return (
        scoped_logworks(user)
        .filter(review_status=LogWork.ReviewStatus.PENDING)
        .values("user_id", "work_date")
        .distinct()
        .count()
    )


def build_workload_per_employee(user, month, year):
    """
    So sánh workload theo Employee:
    - open_task_count
    - logged_hours trong tháng
    - capacity_hours
    - utilization_rate (%)
    - workload_status (Normal | High | Overloaded)
    """
    start_date, end_date = get_month_range(month, year)

    daily_hours = getattr(settings, "DAILY_WORKING_HOURS", 8)
    working_days = calculate_working_days(start_date, end_date)
    max_capacity_hours = float(working_days * daily_hours)

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
            "capacity_hours": max_capacity_hours,
            "utilization_rate": 0.0,
            "workload_status": "Normal",
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
                "capacity_hours": max_capacity_hours,
                "utilization_rate": 0.0,
                "workload_status": "Normal",
            }

        data[user_id]["logged_hours"] = decimal_to_float(
            row["logged_hours"]
        )

    for user_id, emp_data in data.items():
        logged_h = emp_data["logged_hours"]
        if max_capacity_hours > 0:
            rate = round((logged_h / max_capacity_hours) * 100, 1)
        else:
            rate = 0.0

        if rate < 70.0:
            status = "Normal"
        elif rate < 90.0:
            status = "High"
        else:
            status = "Overloaded"

        emp_data["utilization_rate"] = rate
        emp_data["workload_status"] = status

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
    status_summary, overdue_task_rate = build_task_metrics_summary(user)
    hours_summary = build_team_hours_summary(user, month, year)
    pending_timesheets_count = build_pending_timesheets_count(user)

    return {
        "month": month,
        "year": year,
        "managed_jobs_count": managed_jobs_count,
        "task_status_summary": status_summary,
        "overdue_task_rate": overdue_task_rate,
        "team_total_hours": hours_summary["team_total_hours"],
        "team_approved_hours": hours_summary["team_approved_hours"],
        "team_pending_hours": hours_summary["team_pending_hours"],
        "team_rejected_hours": hours_summary["team_rejected_hours"],
        "pending_timesheets_count": pending_timesheets_count,
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