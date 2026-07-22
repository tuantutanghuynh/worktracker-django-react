from datetime import date
from decimal import Decimal

from django.db.models import Count

from tasks.models import Task
from system.security.scoping_manager import scoped_tasks


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


def apply_task_summary_filters(queryset, filters):
    job_id = filters.get("job_id")
    assignee_id = filters.get("assignee_id")
    status = filters.get("status")
    priority = filters.get("priority")
    deadline_from = filters.get("deadline_from")
    deadline_to = filters.get("deadline_to")

    if job_id:
        queryset = queryset.filter(job_id=job_id)

    if assignee_id:
        queryset = queryset.filter(assignee_id=assignee_id)

    if status:
        queryset = queryset.filter(status=status)

    if priority:
        queryset = queryset.filter(priority=priority)

    if deadline_from:
        queryset = queryset.filter(deadline__gte=deadline_from)

    if deadline_to:
        queryset = queryset.filter(deadline__lte=deadline_to)

    return queryset


def build_status_summary(queryset):
    summary = {
        status_value: 0
        for status_value, status_label in Task.Status.choices
    }

    rows = (
        queryset
        .values("status")
        .annotate(total=Count("id"))
        .order_by("status")
    )

    for row in rows:
        summary[row["status"]] = row["total"]

    return summary


def build_priority_summary(queryset):
    summary = {
        priority_value: 0
        for priority_value, priority_label in Task.Priority.choices
    }

    rows = (
        queryset
        .values("priority")
        .annotate(total=Count("id"))
        .order_by("priority")
    )

    for row in rows:
        summary[row["priority"]] = row["total"]

    return summary


def build_job_summary(queryset):
    rows = (
        queryset
        .values(
            "job_id",
            "job__job_name",
            "job__status",
            "job__deadline",
        )
        .annotate(total_tasks=Count("id"))
        .order_by("job__job_name")
    )

    return [
        {
            "job_id": row["job_id"],
            "job_name": row["job__job_name"],
            "job_status": row["job__status"],
            "job_deadline": row["job__deadline"],
            "total_tasks": row["total_tasks"],
        }
        for row in rows
    ]


def build_assignee_summary(queryset):
    rows = (
        queryset
        .values(
            "assignee_id",
            "assignee__email",
            "assignee__profile__full_name",
        )
        .annotate(total_tasks=Count("id"))
        .order_by("assignee__email")
    )

    return [
        {
            "assignee_id": row["assignee_id"],
            "email": row["assignee__email"],
            "full_name": (
                row["assignee__profile__full_name"]
                or row["assignee__email"]
            ),
            "total_tasks": row["total_tasks"],
        }
        for row in rows
    ]


def build_overdue_summary(queryset):
    today = date.today()

    active_queryset = queryset.exclude(
        status__in=[
            Task.Status.COMPLETED,
            Task.Status.CANCELLED,
        ]
    )

    total_active_tasks = active_queryset.count()

    overdue_tasks = active_queryset.filter(
        deadline__lt=today,
    ).count()

    if total_active_tasks == 0:
        overdue_rate = 0

    else:
        overdue_rate = round(
            overdue_tasks / total_active_tasks * 100,
            2,
        )

    return {
        "total_active_tasks": total_active_tasks,
        "overdue_tasks": overdue_tasks,
        "overdue_rate_percent": overdue_rate,
    }


def serialize_task_row(task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "deadline": task.deadline,
        "completed_at": task.completed_at,
        "order_index": task.order_index,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "job": {
            "id": task.job_id,
            "job_name": task.job.job_name,
            "status": task.job.status,
            "deadline": task.job.deadline,
        },
        "assignee": {
            "id": task.assignee_id,
            "email": task.assignee.email,
            "full_name": user_display_name(task.assignee),
        },
        "creator": {
            "id": task.creator_id,
            "email": task.creator.email,
            "full_name": user_display_name(task.creator),
        },
    }


def build_task_summary_report(*, user, filters):
    """
    Manager Task Summary Report.

    Scope bắt buộc:
        tasks.job.manager_id = request.user.id

    Report này chỉ đọc dữ liệu, không ghi dữ liệu nghiệp vụ.
    """
    base_queryset = (
        scoped_tasks(user)
        .select_related(
            "job",
            "assignee",
            "assignee__profile",
            "creator",
            "creator__profile",
        )
    )

    filtered_queryset = apply_task_summary_filters(
        base_queryset,
        filters,
    )

    filtered_queryset = filtered_queryset.order_by(
        "job__job_name",
        "status",
        "deadline",
        "order_index",
    )

    return {
        "filters": dict(filters),
        "summary": {
            "total_tasks": filtered_queryset.count(),
            "status_summary": build_status_summary(filtered_queryset),
            "priority_summary": build_priority_summary(filtered_queryset),
            "overdue_summary": build_overdue_summary(filtered_queryset),
            "job_summary": build_job_summary(filtered_queryset),
            "assignee_summary": build_assignee_summary(filtered_queryset),
        },
        "rows": [
            serialize_task_row(task)
            for task in filtered_queryset
        ],
    }