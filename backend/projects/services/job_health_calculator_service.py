"""
Module: projects.services.job_health_calculator_service
Description: Calculates dynamic project job health indicators and velocity-to-deadline forecast metrics.
"""

from django.utils import timezone


def calculate_job_health(job, task_counts=None, today=None):
    """Calculate dynamic Job Health and risk indicator based on velocity-to-deadline forecast."""
    if today is None:
        today = timezone.localdate()

    if job.status == "COMPLETED":
        return {
            "code": "COMPLETED",
            "label": "Completed",
            "color": "green",
            "risk_ratio": 0.0,
            "velocity_per_day": 0.0,
            "estimated_days_needed": 0.0,
            "days_remaining": 0,
            "days_elapsed": (
                max((job.deadline - job.start_date).days, 0)
                if job.start_date and job.deadline
                else 0
            ),
        }

    if job.status == "CANCELLED":
        return {
            "code": "CANCELLED",
            "label": "Cancelled",
            "color": "gray",
            "risk_ratio": None,
            "velocity_per_day": 0.0,
            "estimated_days_needed": None,
            "days_remaining": 0,
            "days_elapsed": 0,
        }

    start_date = job.start_date or today
    deadline = job.deadline or today

    days_elapsed = max((today - start_date).days, 0)
    days_remaining = (deadline - today).days

    if task_counts is None:
        from tasks.models import Task
        from django.db.models import Count, Q

        counts = job.tasks.aggregate(
            total_tasks=Count("id"),
            todo_count=Count("id", filter=Q(status=Task.Status.TODO)),
            in_progress_count=Count("id", filter=Q(status=Task.Status.IN_PROGRESS)),
            reviewing_count=Count("id", filter=Q(status=Task.Status.REVIEWING)),
            completed_count=Count("id", filter=Q(status=Task.Status.COMPLETED)),
            cancelled_count=Count("id", filter=Q(status=Task.Status.CANCELLED)),
        )
    else:
        counts = task_counts

    total_tasks = counts.get("total_tasks", 0)
    completed_count = counts.get("completed_count", 0)
    todo_count = counts.get("todo_count", 0)
    in_progress_count = counts.get("in_progress_count", 0)
    reviewing_count = counts.get("reviewing_count", 0)

    active_backlog = todo_count + in_progress_count + reviewing_count

    if days_remaining < 0:
        return {
            "code": "OVERDUE",
            "label": "Overdue",
            "color": "red",
            "risk_ratio": 99.9,
            "velocity_per_day": round(completed_count / max(days_elapsed, 1), 2),
            "estimated_days_needed": None,
            "days_remaining": days_remaining,
            "days_elapsed": days_elapsed,
        }

    if total_tasks > 0 and active_backlog == 0:
        return {
            "code": "ON_TRACK",
            "label": "All Tasks Done",
            "color": "green",
            "risk_ratio": 0.0,
            "velocity_per_day": round(completed_count / max(days_elapsed, 1), 2),
            "estimated_days_needed": 0.0,
            "days_remaining": days_remaining,
            "days_elapsed": days_elapsed,
        }

    if days_elapsed <= 3 and completed_count == 0:
        return {
            "code": "PLANNING",
            "label": "Planning / Kickoff",
            "color": "blue",
            "risk_ratio": None,
            "velocity_per_day": 0.0,
            "estimated_days_needed": None,
            "days_remaining": days_remaining,
            "days_elapsed": days_elapsed,
        }

    effective_elapsed = max(days_elapsed, 1)
    velocity = completed_count / effective_elapsed

    if velocity <= 0:
        return {
            "code": "CRITICAL",
            "label": "Stalled / No Velocity",
            "color": "red",
            "risk_ratio": 99.9,
            "velocity_per_day": 0.0,
            "estimated_days_needed": None,
            "days_remaining": days_remaining,
            "days_elapsed": days_elapsed,
        }

    estimated_days_needed = active_backlog / velocity
    effective_remaining = max(days_remaining, 1)
    risk_ratio = round(estimated_days_needed / effective_remaining, 2)

    if risk_ratio <= 1.0:
        code = "ON_TRACK"
        label = "On Track"
        color = "green"
    elif risk_ratio <= 1.25:
        code = "AT_RISK"
        label = "At Risk"
        color = "yellow"
    else:
        code = "CRITICAL"
        label = "Critical"
        color = "red"

    return {
        "code": code,
        "label": label,
        "color": color,
        "risk_ratio": risk_ratio,
        "velocity_per_day": round(velocity, 2),
        "estimated_days_needed": round(estimated_days_needed, 1),
        "days_remaining": days_remaining,
        "days_elapsed": days_elapsed,
    }
