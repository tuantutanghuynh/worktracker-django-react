"""
Module: tasks.services.task_deadline_calculator_service
Description: Service computing task deadline health indicators, remaining days, and percentage thresholds.
"""

from django.utils import timezone


def calculate_task_deadline_health(task, today=None):
    """Calculate dynamic task deadline health and remaining time percentage."""
    if today is None:
        today = timezone.localdate()

    if task.status == "COMPLETED":
        created_date = (
            task.created_at.date()
            if hasattr(task, "created_at") and task.created_at
            else today
        )
        deadline = task.deadline or today
        total_days = max((deadline - created_date).days, 1)

        return {
            "code": "COMPLETED",
            "label": "Completed",
            "color": "green",
            "remaining_percent": 100.0,
            "days_remaining": 0,
            "total_days": total_days,
        }

    if task.status == "CANCELLED":
        return {
            "code": "CANCELLED",
            "label": "Cancelled",
            "color": "gray",
            "remaining_percent": 0.0,
            "days_remaining": 0,
            "total_days": 0,
        }

    created_date = (
        task.created_at.date()
        if hasattr(task, "created_at") and task.created_at
        else (
            task.job.start_date
            if hasattr(task, "job") and task.job and task.job.start_date
            else today
        )
    )
    deadline = task.deadline or today

    total_days = max((deadline - created_date).days, 1)
    days_remaining = (deadline - today).days

    if days_remaining < 0:
        return {
            "code": "OVERDUE",
            "label": "Overdue",
            "color": "red",
            "remaining_percent": 0.0,
            "days_remaining": days_remaining,
            "total_days": total_days,
        }

    remaining_percent = round(
        min(max((days_remaining / total_days) * 100, 0.0), 100.0), 1
    )

    if remaining_percent < 20.0:
        code = "CRITICAL"
        label = "Urgent"
        color = "red"
    elif remaining_percent <= 50.0:
        code = "WARNING"
        label = "Due Soon"
        color = "yellow"
    else:
        code = "ON_TRACK"
        label = "On Track"
        color = "green"

    return {
        "code": code,
        "label": label,
        "color": color,
        "remaining_percent": remaining_percent,
        "days_remaining": days_remaining,
        "total_days": total_days,
    }
