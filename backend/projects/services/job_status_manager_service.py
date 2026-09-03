"""
Module: projects.services.job_status_manager_service
Description: Service managing state transitions, business rules, and audit trails for project job statuses.
"""

from django.db import transaction
from rest_framework.exceptions import APIException, PermissionDenied

from projects.models import Job
from tasks.models import Task
from timesheets.models import LogWork
from system.services.audit_manager_service import snapshot, log_action


class BusinessRuleError(APIException):
    """Exception indicating violation of a domain business rule constraint."""
    status_code = 400
    default_detail = "Business rule violation."
    default_code = "business_rule_error"


class InvalidTransition(APIException):
    """Exception indicating an impermissible state transition for job status."""
    status_code = 400
    default_detail = "Invalid job status transition."
    default_code = "invalid_job_status_transition"


JOB_TRANSITIONS = {
    (Job.Status.PLANNING, Job.Status.ACTIVE): {
        "reason_required": False,
        "condition": None,
    },
    (Job.Status.PLANNING, Job.Status.CANCELLED): {
        "reason_required": True,
        "condition": None,
    },
    (Job.Status.ACTIVE, Job.Status.ON_HOLD): {
        "reason_required": True,
        "condition": None,
    },
    (Job.Status.ON_HOLD, Job.Status.ACTIVE): {
        "reason_required": False,
        "condition": None,
    },
    (Job.Status.ACTIVE, Job.Status.COMPLETED): {
        "reason_required": False,
        "condition": "manager_check_job_completable",
    },
    (Job.Status.ACTIVE, Job.Status.CANCELLED): {
        "reason_required": True,
        "condition": None,
    },
    (Job.Status.ON_HOLD, Job.Status.CANCELLED): {
        "reason_required": True,
        "condition": None,
    },
}


def manager_assert_job_owner(user, job):
    """Ensure that the requesting manager is the assigned owner of the job."""
    if not user or not user.is_authenticated:
        raise PermissionDenied("AUTHENTICATION_REQUIRED")

    role_code = getattr(getattr(user, "role", None), "code", None)

    if role_code != "MANAGER":
        raise PermissionDenied("MANAGER_ROLE_REQUIRED")

    if job.manager_id != user.id:
        raise PermissionDenied("JOB_OUT_OF_MANAGER_SCOPE")


def manager_check_job_completable(job):
    """Verify that a job has no open tasks or pending log works before completion."""
    has_open_tasks = Task.objects.filter(
        job_id=job.id,
        status__in=[
            Task.Status.TODO,
            Task.Status.IN_PROGRESS,
            Task.Status.REVIEWING,
        ],
    ).exists()

    if has_open_tasks:
        raise BusinessRuleError("JOB_HAS_OPEN_TASKS")

    has_pending_logworks = LogWork.objects.filter(
        task__job_id=job.id,
        review_status=LogWork.ReviewStatus.PENDING,
    ).exists()

    if has_pending_logworks:
        raise BusinessRuleError("JOB_HAS_PENDING_LOGWORK")


def validate_job_transition(job, new_status, reason):
    """Validate requested job status change against transition matrix and active client status."""
    if job.client and not job.client.is_active and new_status != Job.Status.CANCELLED:
        raise BusinessRuleError(
            f"Cannot change status to '{new_status}' because client '{job.client.client_name}' is deactivated by Admin. "
            "The project is frozen and requires Admin to restore the client first."
        )

    transition_key = (job.status, new_status)
    rule = JOB_TRANSITIONS.get(transition_key)

    if rule is None:
        raise InvalidTransition("INVALID_JOB_STATUS_TRANSITION")

    if rule["reason_required"] and not reason:
        raise BusinessRuleError("REASON_REQUIRED")

    condition = rule.get("condition")

    if condition == "manager_check_job_completable":
        manager_check_job_completable(job)


def manager_change_job_status(*, user, job, new_status, reason=None, request=None):
    """Update job status within atomic transaction with row locking and audit logging."""
    with transaction.atomic():
        locked_job = Job.objects.select_related("client").select_for_update().get(id=job.id)

        manager_assert_job_owner(user, locked_job)

        clean_reason = reason.strip() if isinstance(reason, str) else reason

        validate_job_transition(
            job=locked_job,
            new_status=new_status,
            reason=clean_reason,
        )

        old_values = snapshot(
            locked_job,
            fields=["status"],
        )

        locked_job.status = new_status
        locked_job.save(update_fields=["status", "updated_at"])

        log_action(
            user=user,
            action="UPDATE_JOB_STATUS",
            table_name="jobs",
            record_id=locked_job.id,
            old_values=old_values,
            new_values={
                "status": new_status,
                "reason": clean_reason,
            },
            request=request,
        )

    return locked_job