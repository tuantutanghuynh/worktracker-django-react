"""
Module: tasks.services.task_transition_manager_service
Description: Service managing task status transitions, role-based authorization, comment logging, and notifications.
"""

from django.db import transaction
from django.utils import timezone

from rest_framework.exceptions import APIException, PermissionDenied

from tasks.models import Task, TaskComment
from system.models import Notification
from system.services.audit_manager_service import snapshot, log_action
from system.services.notification_manager_service import (
    notify,
    resolve_task_recipients,
)

ACTOR_ASSIGNEE = "ASSIGNEE"
ACTOR_JOB_MANAGER = "JOB_MANAGER"
ACTOR_ADMIN = "ADMIN"

ADMIN_ROLE_CODE = "ADMIN"
MANAGER_ROLE_CODE = "MANAGER"
EMPLOYEE_ROLE_CODE = "EMPLOYEE"


class InvalidTaskTransition(APIException):
    """Exception indicating an impermissible state transition for task status."""
    status_code = 400
    default_detail = "Invalid task status transition."
    default_code = "invalid_task_transition"


class BusinessRuleError(APIException):
    """Exception indicating violation of domain constraints during task transitions."""
    status_code = 400
    default_detail = "Business rule violation."
    default_code = "business_rule_error"


TASK_TRANSITIONS = {
    (Task.Status.TODO, Task.Status.IN_PROGRESS): [
        ACTOR_ASSIGNEE,
        ACTOR_JOB_MANAGER,
    ],
    (Task.Status.IN_PROGRESS, Task.Status.REVIEWING): [
        ACTOR_ASSIGNEE,
    ],
    (Task.Status.IN_PROGRESS, Task.Status.TODO): [
        ACTOR_ASSIGNEE,
        ACTOR_JOB_MANAGER,
    ],
    (Task.Status.REVIEWING, Task.Status.COMPLETED): [
        ACTOR_JOB_MANAGER,
    ],
    (Task.Status.REVIEWING, Task.Status.IN_PROGRESS): [
        ACTOR_JOB_MANAGER,
        ACTOR_ASSIGNEE,
    ],
    (Task.Status.TODO, Task.Status.CANCELLED): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.IN_PROGRESS, Task.Status.CANCELLED): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.REVIEWING, Task.Status.CANCELLED): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.COMPLETED, Task.Status.IN_PROGRESS): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.COMPLETED, Task.Status.TODO): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.CANCELLED, Task.Status.TODO): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
    (Task.Status.CANCELLED, Task.Status.IN_PROGRESS): [
        ACTOR_JOB_MANAGER,
        ACTOR_ADMIN,
    ],
}

EVENT_MAP = {
    (
        Task.Status.IN_PROGRESS,
        Task.Status.REVIEWING,
    ): Notification.EventType.TASK_SUBMITTED,
    (
        Task.Status.REVIEWING,
        Task.Status.COMPLETED,
    ): Notification.EventType.TASK_APPROVED,
    (
        Task.Status.REVIEWING,
        Task.Status.IN_PROGRESS,
    ): Notification.EventType.TASK_REJECTED,
}


def get_user_role_code(user):
    """Return normalized role code string for user."""
    role = getattr(user, "role", None)
    return getattr(role, "code", None)


def get_action_name(from_status, to_status):
    """Determine audit log action identifier based on state transition endpoints."""
    if from_status == Task.Status.REVIEWING and to_status == Task.Status.COMPLETED:
        return "APPROVE_TASK"

    if from_status == Task.Status.REVIEWING and to_status == Task.Status.IN_PROGRESS:
        return "REJECT_TASK"

    if to_status == Task.Status.CANCELLED:
        return "CANCEL_TASK"

    if from_status == Task.Status.CANCELLED:
        return "RESTORE_TASK"

    return "UPDATE_TASK_STATUS"


def get_event_type(from_status, to_status):
    """Return notification event type mapped to status transition pair."""
    return EVENT_MAP.get(
        (from_status, to_status),
        Notification.EventType.TASK_STATUS_CHANGED,
    )


def get_transition_title(from_status, to_status, task):
    """Return human-readable notification subject string for status transition."""
    if to_status == Task.Status.COMPLETED:
        return "Task approved"

    if from_status == Task.Status.REVIEWING and to_status == Task.Status.IN_PROGRESS:
        return "Task rejected"

    if to_status == Task.Status.REVIEWING:
        return "Task submitted for review"

    if to_status == Task.Status.CANCELLED:
        return "Task cancelled"

    if from_status == Task.Status.CANCELLED:
        return "Task restored & reactivated"

    return "Task status changed"


def assert_actor(user, task, allowed_actors):
    """Verify that user role or assignment permits execution of transition."""
    role_code = get_user_role_code(user)

    if ACTOR_ADMIN in allowed_actors and role_code == ADMIN_ROLE_CODE:
        return

    if (
        ACTOR_JOB_MANAGER in allowed_actors
        and role_code == MANAGER_ROLE_CODE
        and task.job.manager_id == user.id
    ):
        return

    if ACTOR_ASSIGNEE in allowed_actors and task.assignee_id == user.id:
        return

    raise PermissionDenied("USER_NOT_ALLOWED_FOR_THIS_TASK_TRANSITION")


def validate_transition(task, to_status, reason=None):
    """Validate transition eligibility, required reasons, and active client constraints."""
    if task.job.client and not task.job.client.is_active and to_status != Task.Status.CANCELLED:
        raise BusinessRuleError("CLIENT_DEACTIVATED_CANNOT_TRANSITION_TASK")

    if task.job.status != "ACTIVE" and to_status != Task.Status.CANCELLED:
        raise BusinessRuleError("JOB_NOT_ACTIVE_CANNOT_TRANSITION_TASK")

    transition_key = (task.status, to_status)
    allowed_actors = TASK_TRANSITIONS.get(transition_key)

    if allowed_actors is None:
        raise InvalidTaskTransition("INVALID_TASK_STATUS_TRANSITION")

    if (
        task.status == Task.Status.TODO
        and to_status == Task.Status.IN_PROGRESS
    ):
        if task.assignee and getattr(getattr(task.assignee, "role", None), "code", None) == "MANAGER":
            raise BusinessRuleError("MUST_ASSIGN_TO_EMPLOYEE_BEFORE_STARTING")

        if task.description and "[LOCKED_FOR_REASSIGNMENT]" in task.description:
            raise BusinessRuleError("TASK_LOCKED_FOR_REASSIGNMENT_EMPLOYEE_PHASE_OUT")

    if (
        task.status == Task.Status.IN_PROGRESS
        and to_status == Task.Status.REVIEWING
    ):
        from timesheets.models import LogWork
        has_logged_work = LogWork.objects.filter(
            task=task,
            review_status__in=[LogWork.ReviewStatus.PENDING, LogWork.ReviewStatus.APPROVED],
            hours_spent__gt=0,
        ).exists()
        if not has_logged_work:
            raise BusinessRuleError("LOGGED_WORK_REQUIRED_BEFORE_SUBMISSION")

    if (
        task.status == Task.Status.REVIEWING
        and to_status == Task.Status.IN_PROGRESS
        and not reason
    ):
        raise BusinessRuleError("REJECTION_REASON_REQUIRED")

    if to_status == Task.Status.CANCELLED and not reason:
        raise BusinessRuleError("CANCELLATION_REASON_REQUIRED")

    if (
        task.status == Task.Status.COMPLETED
        and to_status in (Task.Status.IN_PROGRESS, Task.Status.TODO)
        and not reason
    ):
        raise BusinessRuleError("REWORK_REASON_REQUIRED")

    return allowed_actors


def apply_transition(*, user, task, to_status, reason=None, request=None):
    """Execute task status transition, create rejection comments, and broadcast notifications."""
    clean_reason = reason.strip() if isinstance(reason, str) else reason

    with transaction.atomic():
        locked_task = (
            Task.objects.select_for_update()
            .select_related("job", "assignee", "creator")
            .get(pk=task.pk)
        )

        from_status = locked_task.status

        allowed_actors = validate_transition(
            task=locked_task,
            to_status=to_status,
            reason=clean_reason,
        )

        assert_actor(
            user=user,
            task=locked_task,
            allowed_actors=allowed_actors,
        )

        old_values = snapshot(
            locked_task,
            fields=["status", "completed_at"],
        )

        if to_status == Task.Status.COMPLETED:
            locked_task.completed_at = timezone.now()
        else:
            locked_task.completed_at = None

        locked_task.status = to_status

        locked_task.save(
            update_fields=[
                "status",
                "completed_at",
                "updated_at",
            ]
        )

        if (
            from_status == Task.Status.REVIEWING
            and to_status == Task.Status.IN_PROGRESS
        ):
            is_recall = (user == locked_task.assignee)
            prefix = "[Submission Recalled]: " if is_recall else "[Rejection Note]: "
            TaskComment.objects.create(
                task=locked_task,
                user=user,
                content=f"{prefix}{clean_reason}" if clean_reason else ("Submission recalled by employee" if is_recall else "Task rejected by manager"),
                comment_type=TaskComment.CommentType.REJECTION_NOTE,
            )

        if from_status == Task.Status.COMPLETED and to_status in (
            Task.Status.IN_PROGRESS,
            Task.Status.TODO,
        ):
            TaskComment.objects.create(
                task=locked_task,
                user=user,
                content=f"[Rework Requested]: {clean_reason}",
                comment_type=TaskComment.CommentType.REJECTION_NOTE,
            )

        if from_status == Task.Status.CANCELLED and to_status in (
            Task.Status.IN_PROGRESS,
            Task.Status.TODO,
        ):
            TaskComment.objects.create(
                task=locked_task,
                user=user,
                content=f"[Task Restored]: Task reactivated by Manager" + (f" - Reason: {clean_reason}" if clean_reason else ""),
                comment_type=TaskComment.CommentType.NORMAL,
            )

        action_name = get_action_name(
            from_status=from_status,
            to_status=to_status,
        )

        log_action(
            user=user,
            action=action_name,
            table_name="tasks",
            record_id=locked_task.id,
            old_values=old_values,
            new_values={
                "status": locked_task.status,
                "completed_at": locked_task.completed_at,
                "reason": clean_reason,
            },
            request=request,
        )

        if to_status == Task.Status.COMPLETED:
            remaining_tasks_count = Task.objects.filter(
                job_id=locked_task.job_id,
                assignee_id=locked_task.assignee_id,
                status__in=[Task.Status.TODO, Task.Status.IN_PROGRESS, Task.Status.REVIEWING]
            ).exclude(id=locked_task.id).count()

            if remaining_tasks_count == 0:
                log_action(
                    user=user,
                    action="AUTO_RELEASE_EMPLOYEE",
                    table_name="jobs",
                    record_id=locked_task.job_id,
                    old_values=None,
                    new_values={
                        "released_user_id": locked_task.assignee_id,
                        "job_id": locked_task.job_id,
                        "note": "Employee completed all tasks in this job and is fully released."
                    },
                    request=request,
                )

        recipients = resolve_task_recipients(
            locked_task,
            exclude_user=user,
        )

        for recipient in recipients:
            is_mgr = getattr(recipient, 'role', None) and getattr(recipient.role, 'name', '').upper() == 'MANAGER'
            target_url = "/manager/tasks/review" if is_mgr else "/employee/my-tasks"
            notify(
                recipients=[recipient],
                event_type=get_event_type(from_status, to_status),
                title=get_transition_title(from_status, to_status, locked_task),
                content=f"Task status changed from {from_status} to {to_status}: {locked_task.title}",
                related_url=target_url,
                channel=Notification.ChannelType.SYSTEM_ONLY,
            )

        if to_status == Task.Status.REVIEWING:
            try:
                from tasks.services.task_email_service import send_task_submitted_email
                send_task_submitted_email(locked_task, note=clean_reason, request=request)
            except Exception:
                pass

        if (
            from_status == Task.Status.REVIEWING
            and to_status == Task.Status.IN_PROGRESS
            and user != locked_task.assignee
        ):
            try:
                from tasks.services.task_email_service import send_task_rejected_email
                send_task_rejected_email(locked_task, reason=clean_reason, reviewer=user, request=request)
            except Exception:
                pass

    return locked_task
