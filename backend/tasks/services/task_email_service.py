"""
Module: tasks.services.task_email_service
Description: Email dispatch service delivering templated notifications for task assignments, submissions, rejections, and team additions.
"""

import logging
from django.conf import settings
from system.services.email_service import send_templated_email

logger = logging.getLogger(__name__)


def send_task_assigned_email(task, request=None):
    """Send templated email notification to assignee upon new task assignment."""
    if not task.assignee or not task.assignee.email:
        return False

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    assignee_profile = getattr(task.assignee, "profile", None)
    creator_profile = getattr(task.creator, "profile", None) if task.creator else None

    context = {
        "assignee_name": getattr(assignee_profile, "full_name", "") or task.assignee.email,
        "task_title": task.title,
        "job_code": task.job.job_code if task.job else f"JOB-{task.job_id}",
        "job_name": task.job.job_name if task.job else "",
        "creator_name": getattr(creator_profile, "full_name", "") or (task.creator.email if task.creator else "Project Manager"),
        "priority": task.priority,
        "deadline": task.deadline.strftime("%B %d, %Y") if task.deadline else None,
        "task_description": task.description,
        "task_url": f"{frontend_url}/employee/tasks",
    }

    return send_templated_email(
        template_name="task_assigned",
        subject=f"You have been assigned to task: {task.title}",
        to=task.assignee.email,
        context=context,
    )


def send_task_submitted_email(task, note="", request=None):
    """Send templated email notification to manager when task is submitted for review."""
    if not task.job or not task.job.manager or not task.job.manager.email:
        return False

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    manager_profile = getattr(task.job.manager, "profile", None)
    assignee_profile = getattr(task.assignee, "profile", None) if task.assignee else None

    context = {
        "manager_name": getattr(manager_profile, "full_name", "") or task.job.manager.email,
        "assignee_name": getattr(assignee_profile, "full_name", "") or (task.assignee.email if task.assignee else "Team Member"),
        "assignee_email": task.assignee.email if task.assignee else "",
        "task_title": task.title,
        "job_code": task.job.job_code if task.job else f"JOB-{task.job_id}",
        "job_name": task.job.job_name if task.job else "",
        "submission_note": note,
        "review_url": f"{frontend_url}/manager/tasks/review",
    }

    return send_templated_email(
        template_name="task_submitted",
        subject=f"Task submitted for review: {task.title}",
        to=task.job.manager.email,
        context=context,
    )


def send_task_rejected_email(task, reason="", reviewer=None, request=None):
    """Send templated email notification to assignee when task review is rejected."""
    if not task.assignee or not task.assignee.email:
        return False

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    assignee_profile = getattr(task.assignee, "profile", None)
    reviewer_profile = getattr(reviewer, "profile", None) if reviewer else None

    context = {
        "assignee_name": getattr(assignee_profile, "full_name", "") or task.assignee.email,
        "task_title": task.title,
        "job_code": task.job.job_code if task.job else f"JOB-{task.job_id}",
        "job_name": task.job.job_name if task.job else "",
        "rejection_reason": reason,
        "reviewer_name": getattr(reviewer_profile, "full_name", "") or (reviewer.email if reviewer else "Project Manager"),
        "task_url": f"{frontend_url}/employee/tasks",
    }

    return send_templated_email(
        template_name="task_rejected",
        subject=f"Task rework requested: {task.title}",
        to=task.assignee.email,
        context=context,
    )


def send_project_team_added_email(job, member, request=None):
    """Send templated email notification to user when assigned to project job team."""
    if not member or not member.email:
        return False

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    member_profile = getattr(member, "profile", None)
    manager_profile = getattr(job.manager, "profile", None) if job.manager else None

    is_mgr = getattr(getattr(member, "role", None), "code", "").upper() == "MANAGER"
    chat_path = "/manager/chat" if is_mgr else "/employee/chat"

    context = {
        "member_name": getattr(member_profile, "full_name", "") or member.email,
        "job_code": job.job_code or f"JOB-{job.id}",
        "job_name": job.job_name,
        "manager_name": getattr(manager_profile, "full_name", "") or (job.manager.email if job.manager else "Unassigned"),
        "manager_email": job.manager.email if job.manager else None,
        "client_name": getattr(getattr(job, "client", None), "name", "Internal Initiative"),
        "job_description": job.description,
        "channel_url": f"{frontend_url}{chat_path}",
    }

    return send_templated_email(
        template_name="project_team_added",
        subject=f"Welcome to project: {job.job_name}",
        to=member.email,
        context=context,
    )
