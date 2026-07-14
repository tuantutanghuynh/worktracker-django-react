from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from timesheets.models import LogWork
from system.scoping_manager import scoped_logworks
from system.services.audit_manager_service import snapshot, log_action

from timesheets.services.daily_total_manager_service import (
    assert_daily_total_not_exceed_24,
    rebuild_daily_user_timesheet,
)
from timesheets.services.timelock_manager_service import (
    assert_period_open_for_job,
)


class LogWorkReviewError(APIException):
    status_code = 400
    default_detail = "LogWork review rule violation."
    default_code = "logwork_review_error"


def assert_logwork_in_manager_scope(user, logwork):
    """
    Manager chỉ xử lý LogWork thuộc Task thuộc Job của mình.
    """
    if logwork.task.job.manager_id != user.id:
        raise PermissionDenied("LOGWORK_OUT_OF_MANAGER_SCOPE")


def get_locked_scoped_logwork(user, logwork_id):
    return (
        scoped_logworks(user)
        .select_for_update()
        .select_related(
            "task",
            "task__job",
            "user",
            "reviewed_by",
            "adjusted_by",
        )
        .get(pk=logwork_id)
    )


def approve_logwork(
    *,
    user,
    logwork,
    note=None,
    request=None,
):
    """
    Manager approve LogWork.

    Chỉ cho approve khi kỳ công chưa bị lock.
    """
    with transaction.atomic():
        locked_logwork = get_locked_scoped_logwork(
            user=user,
            logwork_id=logwork.id,
        )

        assert_logwork_in_manager_scope(user, locked_logwork)

        assert_period_open_for_job(
            job_id=locked_logwork.task.job_id,
            work_date=locked_logwork.work_date,
        )

        if locked_logwork.review_status == LogWork.ReviewStatus.VOIDED:
            raise LogWorkReviewError("VOIDED_LOGWORK_CANNOT_BE_APPROVED")

        if locked_logwork.review_status == LogWork.ReviewStatus.APPROVED:
            raise LogWorkReviewError("LOGWORK_ALREADY_APPROVED")

        old_values = snapshot(
            locked_logwork,
            fields=[
                "review_status",
                "reviewed_by",
                "reviewed_at",
                "reviewed_note",
            ],
        )

        locked_logwork.review_status = LogWork.ReviewStatus.APPROVED
        locked_logwork.reviewed_by = user
        locked_logwork.reviewed_at = timezone.now()
        locked_logwork.reviewed_note = note
        locked_logwork.save(
            update_fields=[
                "review_status",
                "reviewed_by",
                "reviewed_at",
                "reviewed_note",
                "updated_at",
            ]
        )

        rebuild_daily_user_timesheet(
            user_id=locked_logwork.user_id,
            work_date=locked_logwork.work_date,
        )

        log_action(
            user=user,
            action="APPROVE_LOG_WORK",
            table_name="log_works",
            record_id=locked_logwork.id,
            old_values=old_values,
            new_values=snapshot(
                locked_logwork,
                fields=[
                    "review_status",
                    "reviewed_by",
                    "reviewed_at",
                    "reviewed_note",
                ],
            ),
            request=request,
        )

    return locked_logwork


def reject_logwork(
    *,
    user,
    logwork,
    reason,
    request=None,
):
    """
    Manager reject LogWork.

    Reject bắt buộc có lý do.
    """
    if not reason or not str(reason).strip():
        raise ValidationError(
            {
                "reason": "Reject reason is required."
            }
        )

    clean_reason = str(reason).strip()

    with transaction.atomic():
        locked_logwork = get_locked_scoped_logwork(
            user=user,
            logwork_id=logwork.id,
        )

        assert_logwork_in_manager_scope(user, locked_logwork)

        assert_period_open_for_job(
            job_id=locked_logwork.task.job_id,
            work_date=locked_logwork.work_date,
        )

        if locked_logwork.review_status == LogWork.ReviewStatus.VOIDED:
            raise LogWorkReviewError("VOIDED_LOGWORK_CANNOT_BE_REJECTED")

        if locked_logwork.review_status == LogWork.ReviewStatus.REJECTED:
            raise LogWorkReviewError("LOGWORK_ALREADY_REJECTED")

        old_values = snapshot(
            locked_logwork,
            fields=[
                "review_status",
                "reviewed_by",
                "reviewed_at",
                "reviewed_note",
            ],
        )

        locked_logwork.review_status = LogWork.ReviewStatus.REJECTED
        locked_logwork.reviewed_by = user
        locked_logwork.reviewed_at = timezone.now()
        locked_logwork.reviewed_note = clean_reason
        locked_logwork.save(
            update_fields=[
                "review_status",
                "reviewed_by",
                "reviewed_at",
                "reviewed_note",
                "updated_at",
            ]
        )

        rebuild_daily_user_timesheet(
            user_id=locked_logwork.user_id,
            work_date=locked_logwork.work_date,
        )

        log_action(
            user=user,
            action="REJECT_LOG_WORK",
            table_name="log_works",
            record_id=locked_logwork.id,
            old_values=old_values,
            new_values=snapshot(
                locked_logwork,
                fields=[
                    "review_status",
                    "reviewed_by",
                    "reviewed_at",
                    "reviewed_note",
                ],
            ),
            request=request,
        )

    return locked_logwork


def correct_logwork(
    *,
    user,
    logwork,
    hours_spent=None,
    description=None,
    adjustment_reason=None,
    request=None,
):
    """
    Manager chỉnh LogWork.

    Có thể chỉnh:
    - hours_spent
    - description

    Bắt buộc có adjustment_reason.
    """
    if not adjustment_reason or not str(adjustment_reason).strip():
        raise ValidationError(
            {
                "adjustment_reason": "Adjustment reason is required."
            }
        )

    clean_reason = str(adjustment_reason).strip()

    with transaction.atomic():
        locked_logwork = get_locked_scoped_logwork(
            user=user,
            logwork_id=logwork.id,
        )

        assert_logwork_in_manager_scope(user, locked_logwork)

        assert_period_open_for_job(
            job_id=locked_logwork.task.job_id,
            work_date=locked_logwork.work_date,
        )

        if locked_logwork.review_status == LogWork.ReviewStatus.VOIDED:
            raise LogWorkReviewError("VOIDED_LOGWORK_CANNOT_BE_CORRECTED")

        old_values = snapshot(
            locked_logwork,
            fields=[
                "hours_spent",
                "description",
                "adjusted_by",
                "adjusted_at",
                "adjustment_reason",
            ],
        )

        if hours_spent is not None:
            assert_daily_total_not_exceed_24(
                user_id=locked_logwork.user_id,
                work_date=locked_logwork.work_date,
                new_hours=hours_spent,
                exclude_logwork_id=locked_logwork.id,
            )

            locked_logwork.hours_spent = hours_spent

        if description is not None:
            locked_logwork.description = description

        locked_logwork.adjusted_by = user
        locked_logwork.adjusted_at = timezone.now()
        locked_logwork.adjustment_reason = clean_reason
        locked_logwork.save(
            update_fields=[
                "hours_spent",
                "description",
                "adjusted_by",
                "adjusted_at",
                "adjustment_reason",
                "updated_at",
            ]
        )

        rebuild_daily_user_timesheet(
            user_id=locked_logwork.user_id,
            work_date=locked_logwork.work_date,
        )

        log_action(
            user=user,
            action="CORRECT_LOG_WORK",
            table_name="log_works",
            record_id=locked_logwork.id,
            old_values=old_values,
            new_values=snapshot(
                locked_logwork,
                fields=[
                    "hours_spent",
                    "description",
                    "adjusted_by",
                    "adjusted_at",
                    "adjustment_reason",
                ],
            ),
            request=request,
        )

    return locked_logwork


def void_logwork(
    *,
    user,
    logwork,
    reason,
    request=None,
):
    """
    Manager void LogWork sai.

    VOIDED nghĩa là log không còn được tính vào tổng giờ.
    """
    if not reason or not str(reason).strip():
        raise ValidationError(
            {
                "reason": "Void reason is required."
            }
        )

    clean_reason = str(reason).strip()

    with transaction.atomic():
        locked_logwork = get_locked_scoped_logwork(
            user=user,
            logwork_id=logwork.id,
        )

        assert_logwork_in_manager_scope(user, locked_logwork)

        assert_period_open_for_job(
            job_id=locked_logwork.task.job_id,
            work_date=locked_logwork.work_date,
        )

        if locked_logwork.review_status == LogWork.ReviewStatus.VOIDED:
            raise LogWorkReviewError("LOGWORK_ALREADY_VOIDED")

        old_values = snapshot(
            locked_logwork,
            fields=[
                "review_status",
                "reviewed_by",
                "reviewed_at",
                "reviewed_note",
                "adjusted_by",
                "adjusted_at",
                "adjustment_reason",
            ],
        )

        locked_logwork.review_status = LogWork.ReviewStatus.VOIDED
        locked_logwork.reviewed_by = user
        locked_logwork.reviewed_at = timezone.now()
        locked_logwork.reviewed_note = clean_reason
        locked_logwork.adjusted_by = user
        locked_logwork.adjusted_at = timezone.now()
        locked_logwork.adjustment_reason = clean_reason
        locked_logwork.save(
            update_fields=[
                "review_status",
                "reviewed_by",
                "reviewed_at",
                "reviewed_note",
                "adjusted_by",
                "adjusted_at",
                "adjustment_reason",
                "updated_at",
            ]
        )

        rebuild_daily_user_timesheet(
            user_id=locked_logwork.user_id,
            work_date=locked_logwork.work_date,
        )

        log_action(
            user=user,
            action="VOID_LOG_WORK",
            table_name="log_works",
            record_id=locked_logwork.id,
            old_values=old_values,
            new_values=snapshot(
                locked_logwork,
                fields=[
                    "review_status",
                    "reviewed_by",
                    "reviewed_at",
                    "reviewed_note",
                    "adjusted_by",
                    "adjusted_at",
                    "adjustment_reason",
                ],
            ),
            request=request,
        )

    return locked_logwork