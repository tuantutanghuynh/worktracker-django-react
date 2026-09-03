"""
Module: system.security.scoping_manager
Description: Data scoping and row-level access control functions across system domains.
"""

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404

from accounts.models import EmployeeProfile
from projects.models import Job
from tasks.models import Task, TaskComment, TaskAttachment
from timesheets.models import LogWork, TimeLock
from system.models import AuditLog


ADMIN_ROLE_CODE = "ADMIN"
MANAGER_ROLE_CODE = "MANAGER"
EMPLOYEE_ROLE_CODE = "EMPLOYEE"


def get_user_role_code(user):
    """Retrieve the role code string for a given user safely."""
    role = getattr(user, "role", None)
    return getattr(role, "code", None)


def is_admin(user):
    """Check if the user has the Admin role."""
    return get_user_role_code(user) == ADMIN_ROLE_CODE


def is_manager(user):
    """Check if the user has the Manager role."""
    return get_user_role_code(user) == MANAGER_ROLE_CODE


def is_employee(user):
    """Check if the user has the Employee role."""
    return get_user_role_code(user) == EMPLOYEE_ROLE_CODE


def manager_job_ids(user):
    """Return flat list of Job IDs managed by the specified manager user."""
    if not is_manager(user):
        return Job.objects.none().values_list("id", flat=True)

    return Job.objects.filter(
        manager_id=user.id
    ).values_list("id", flat=True)


def scoped_jobs(user):
    """Return Job queryset filtered according to the user's authorization scope."""
    if is_admin(user):
        return Job.objects.all()

    if is_manager(user):
        return Job.objects.filter(manager_id=user.id)

    return Job.objects.none()


def scoped_tasks(user):
    """Return Task queryset filtered to jobs managed by the specified user."""
    if is_admin(user):
        return Task.objects.all()

    if is_manager(user):
        return Task.objects.filter(job__manager_id=user.id)

    return Task.objects.none()


def scoped_task_comments(user):
    """Return TaskComment queryset filtered to tasks within the user's managed jobs."""
    if is_admin(user):
        return TaskComment.objects.all()

    if is_manager(user):
        return TaskComment.objects.filter(
            task__job__manager_id=user.id
        )

    return TaskComment.objects.none()


def scoped_task_attachments(user):
    """Return TaskAttachment queryset filtered to tasks within the user's managed jobs."""
    if is_admin(user):
        return TaskAttachment.objects.all()

    if is_manager(user):
        return TaskAttachment.objects.filter(
            task__job__manager_id=user.id
        )

    return TaskAttachment.objects.none()


def scoped_logworks(user):
    """Return LogWork queryset filtered to tasks belonging to the manager's jobs."""
    if is_admin(user):
        return LogWork.objects.all()

    if is_manager(user):
        return LogWork.objects.filter(
            task__job__manager_id=user.id
        )

    return LogWork.objects.none()


def scoped_timelocks(user):
    """Return TimeLock queryset including job locks managed by user and global locks."""
    if is_admin(user):
        return TimeLock.objects.all()

    if is_manager(user):
        return TimeLock.objects.filter(
            Q(lock_scope=TimeLock.LockScope.JOB, job__manager_id=user.id)
            | Q(lock_scope=TimeLock.LockScope.GLOBAL)
        )

    return TimeLock.objects.none()


def scoped_team_user_ids(user):
    """Return distinct user IDs of employees assigned to tasks in manager's jobs."""
    if not is_manager(user):
        return Task.objects.none().values_list("assignee_id", flat=True)

    return (
        Task.objects.filter(job__manager_id=user.id)
        .values_list("assignee_id", flat=True)
        .distinct()
    )


def employee_job_ids(user):
    """Return distinct Job IDs where the employee has at least one assigned task."""
    if not is_employee(user):
        return Task.objects.none().values_list("job_id", flat=True)

    return (
        Task.objects.filter(assignee_id=user.id)
        .values_list("job_id", flat=True)
        .distinct()
    )


def scoped_team_profiles(user):
    """Return EmployeeProfile queryset for team members assigned to manager's jobs."""
    if is_admin(user):
        return EmployeeProfile.objects.select_related(
            "user",
            "department",
        ).all()

    if is_manager(user):
        return EmployeeProfile.objects.filter(
            user_id__in=scoped_team_user_ids(user)
        ).select_related(
            "user",
            "department",
        )

    return EmployeeProfile.objects.none()


def assignment_search_employees_queryset(job_id=None):
    """Return candidate employee queryset filtered for task assignment within project scope."""
    User = get_user_model()

    qs = User.objects.filter(
        is_active=True,
        role__code=EMPLOYEE_ROLE_CODE,
    ).select_related(
        "role",
        "profile",
        "profile__department",
    )

    if job_id:
        from chat.models import ChatParticipant
        task_assignee_ids = set(Task.objects.filter(job_id=job_id).values_list("assignee_id", flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job_id=job_id, room__room_type='JOB')
            .values_list('user_id', flat=True)
            .distinct()
        )
        team_user_ids = task_assignee_ids | team_participant_ids
        if team_user_ids:
            qs = qs.filter(id__in=team_user_ids)
        else:
            qs = qs.none()

    return qs


def get_scoped_object_or_404(scoped_queryset, **lookup):
    """Fetch object from scoped queryset or raise HTTP 404 if out of scope."""
    return get_object_or_404(scoped_queryset, **lookup)


def assert_job_in_manager_scope(user, job):
    """Validate that the job is managed by user or raise PermissionError."""
    if not is_manager(user):
        raise PermissionError("USER_IS_NOT_MANAGER")

    if job.manager_id != user.id:
        raise PermissionError("JOB_OUT_OF_MANAGER_SCOPE")


def scoped_audit_logs(user):
    """Return AuditLog queryset restricted strictly to manager's accessible scope."""
    if is_admin(user):
        return AuditLog.objects.all()

    if not is_manager(user):
        return AuditLog.objects.none()

    job_ids = list(Job.objects.filter(manager_id=user.id).values_list("id", flat=True))
    task_ids = list(Task.objects.filter(job_id__in=job_ids).values_list("id", flat=True))
    logwork_ids = list(LogWork.objects.filter(task_id__in=task_ids).values_list("id", flat=True))
    timelock_ids = list(TimeLock.objects.filter(job_id__in=job_ids).values_list("id", flat=True))

    scope_condition = (
        Q(user=user)
        | (Q(table_name="jobs") & Q(record_id__in=job_ids))
        | (Q(table_name="tasks") & Q(record_id__in=task_ids))
        | (Q(table_name="log_works") & Q(record_id__in=logwork_ids))
        | (Q(table_name="timesheets") & Q(record_id__in=logwork_ids))
        | (Q(table_name="time_locks") & Q(record_id__in=timelock_ids))
        | (Q(table_name="timelocks") & Q(record_id__in=timelock_ids))
    )

    return AuditLog.objects.filter(scope_condition).distinct()