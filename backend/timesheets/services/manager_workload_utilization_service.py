"""
Module: timesheets.services.manager_workload_utilization_service
Description: Service functions for computing company-wide and team workload utilization statistics.
"""

from datetime import timedelta
from django.conf import settings
from django.db.models import Sum


def calculate_working_days(start_date, end_date, work_days_per_week=None):
    """Calculate the count of working business days between two dates according to week schedule."""
    if hasattr(start_date, "date"):
        start_date = start_date.date()
    if hasattr(end_date, "date"):
        end_date = end_date.date()

    if start_date > end_date:
        raise ValueError("start_date must be less than or equal to end_date")

    if work_days_per_week is None:
        work_days_per_week = getattr(settings, "WORK_DAYS_PER_WEEK", 6)

    max_weekday = 4 if work_days_per_week == 5 else 5

    working_days = 0
    current_date = start_date

    while current_date <= end_date:
        if current_date.weekday() <= max_weekday:
            working_days += 1
        current_date += timedelta(days=1)

    return working_days


def calculate_employee_utilization(user_id, start_date, end_date):
    """Calculate workload utilization percentage and status category for a specific employee."""
    from timesheets.models import LogWork

    daily_hours = getattr(settings, "DAILY_WORKING_HOURS", 8)
    working_days = calculate_working_days(start_date, end_date)
    max_capacity_hours = working_days * daily_hours

    if max_capacity_hours == 0:
        return {
            "user_id": user_id,
            "logged_hours": 0.0,
            "capacity_hours": 0.0,
            "utilization_rate": 0.0,
            "workload_status": "Normal",
        }

    result = (
        LogWork.objects.filter(
            user_id=user_id, work_date__range=(start_date, end_date)
        )
        .exclude(review_status="VOIDED")
        .aggregate(total=Sum("hours_spent"))
    )

    logged_hours = float(result["total"] or 0.0)
    rate = round((logged_hours / max_capacity_hours) * 100, 1)

    if rate < 70.0:
        status = "Normal"
    elif rate < 90.0:
        status = "High"
    else:
        status = "Overloaded"

    return {
        "user_id": user_id,
        "logged_hours": logged_hours,
        "capacity_hours": float(max_capacity_hours),
        "utilization_rate": rate,
        "workload_status": status,
    }


def get_team_workload_summary(manager_user, start_date, end_date):
    """Aggregate company-wide employee workload utilization metrics using grouped database queries."""
    from accounts.models import CustomUser
    from timesheets.models import LogWork

    employees = (
        CustomUser.objects.filter(role__code="EMPLOYEE", is_active=True)
        .select_related("profile", "profile__department")
        .order_by("profile__full_name")
    )

    daily_hours = getattr(settings, "DAILY_WORKING_HOURS", 8)
    working_days = calculate_working_days(start_date, end_date)
    max_capacity_hours = working_days * daily_hours

    logs_summary = (
        LogWork.objects.filter(
            work_date__range=(start_date, end_date),
            user__role__code="EMPLOYEE",
            user__is_active=True,
        )
        .exclude(review_status="VOIDED")
        .values("user_id")
        .annotate(total_hours=Sum("hours_spent"))
    )

    user_hours_map = {item["user_id"]: float(item["total_hours"] or 0.0) for item in logs_summary}

    total_team_logged_hours = 0.0
    overloaded_count = 0
    employee_stats_list = []

    for emp in employees:
        logged_hours = user_hours_map.get(emp.id, 0.0)
        
        if max_capacity_hours > 0:
            rate = round((logged_hours / max_capacity_hours) * 100, 1)
        else:
            rate = 0.0

        if rate < 70.0:
            status = "Normal"
        elif rate < 90.0:
            status = "High"
        else:
            status = "Overloaded"

        total_team_logged_hours += logged_hours
        if status == "Overloaded":
            overloaded_count += 1

        profile = getattr(emp, "profile", None)
        employee_stats_list.append(
            {
                "user_id": emp.id,
                "full_name": profile.full_name if (profile and profile.full_name) else emp.email,
                "email": emp.email,
                "department_name": profile.department.name if (profile and profile.department) else None,
                "logged_hours": logged_hours,
                "capacity_hours": float(max_capacity_hours),
                "utilization_rate": rate,
                "workload_status": status,
            }
        )

    return {
        "total_team_logged_hours": round(total_team_logged_hours, 1),
        "overloaded_count": overloaded_count,
        "team_members_count": len(employee_stats_list),
        "employees": employee_stats_list,
    }