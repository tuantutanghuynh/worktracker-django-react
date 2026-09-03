"""
Module: timesheets.employee.views_employee
Description: Employee-facing API views for creating, editing, voiding, and listing personal work log entries.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from accounts.permissions import HasPermission
from timesheets.employee.serializers_employee import EmployeeLogWorkSerializer, EmployeeLogWorkListSerializer
from system.services.audit_manager_service import snapshot, log_action
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet, assert_daily_total_not_exceed_24
from timesheets.services.timelock_manager_service import assert_period_open_for_job
from timesheets.models import LogWork


class EmployeeLogWorkView(APIView):
    """Create a new work log entry for a task assigned to the authenticated employee."""
    permission_classes = [HasPermission]
    required_permission = "timesheet:create"

    def post(self, request):
        """Validate payload and persist work log entry."""
        serializer = EmployeeLogWorkSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        log_work = serializer.save()

        return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_201_CREATED)


class EmployeeVoidLogWorkView(APIView):
    """Soft-delete a pending work log entry created by the authenticated employee."""
    permission_classes = [HasPermission]
    required_permission = "timesheet:void"

    def patch(self, request, log_work_id):
        """Mark pending work log as VOIDED with required reason."""
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError({"reason": "This field is required."})

        with transaction.atomic():
            log_work = get_object_or_404(
                LogWork.objects.select_related("task").select_for_update(),
                id=log_work_id,
                user_id=request.user.id,
            )

            if log_work.review_status != LogWork.ReviewStatus.PENDING:
                raise ValidationError("Only a PENDING log work can be voided.")

            if log_work.task.job.status != "ACTIVE":
                raise ValidationError(f"Cannot void log work because its project is frozen or on hold ({log_work.task.job.status}).")

            assert_period_open_for_job(
                job_id=log_work.task.job_id,
                work_date=log_work.work_date,
            )

            old_values = snapshot(
                log_work,
                fields=["review_status", "adjusted_by", "adjusted_at", "adjustment_reason"],
            )

            log_work.review_status = LogWork.ReviewStatus.VOIDED
            log_work.adjusted_by = request.user
            log_work.adjusted_at = timezone.now()
            log_work.adjustment_reason = reason
            log_work.save(update_fields=[
                "review_status", "adjusted_by", "adjusted_at",
                "adjustment_reason", "updated_at",
            ])

            rebuild_daily_user_timesheet(user_id=log_work.user_id, work_date=log_work.work_date)

            log_action(
                user=request.user,
                action="VOID_LOG_WORK",
                table_name="log_works",
                record_id=log_work.id,
                old_values=old_values,
                new_values=snapshot(
                    log_work,
                    fields=["review_status", "adjusted_by", "adjusted_at", "adjustment_reason"],
                ),
                request=request,
            )

        return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_200_OK)


class EmployeeEditLogWorkView(APIView):
    """Edit hours or description on a pending work log entry created by the authenticated employee."""
    permission_classes = [HasPermission]
    required_permission = "timesheet:edit"

    def patch(self, request, log_work_id):
        """Update fields on pending work log with reason."""
        reason = request.data.get("adjustment_reason", "").strip()
        if not reason:
            raise ValidationError({"adjustment_reason": "This field is required."})

        hours_spent = request.data.get("hours_spent")
        description = request.data.get("description")

        with transaction.atomic():
            log_work = get_object_or_404(
                LogWork.objects.select_related("task").select_for_update(),
                id=log_work_id,
                user_id=request.user.id,
            )

            if log_work.review_status != LogWork.ReviewStatus.PENDING:
                raise ValidationError("Only a PENDING log work can be edited.")

            if log_work.task.job.status != "ACTIVE":
                raise ValidationError(f"Cannot edit log work because its project is frozen or on hold ({log_work.task.job.status}).")

            assert_period_open_for_job(
                job_id=log_work.task.job_id,
                work_date=log_work.work_date,
            )

            old_values = snapshot(
                log_work,
                fields=["hours_spent", "description", "adjusted_by", "adjusted_at", "adjustment_reason"],
            )

            if hours_spent is not None:
                assert_daily_total_not_exceed_24(
                    user_id=log_work.user_id,
                    work_date=log_work.work_date,
                    new_hours=hours_spent,
                    exclude_logwork_id=log_work.id,
                )
                log_work.hours_spent = hours_spent

            if description is not None:
                log_work.description = description

            log_work.adjusted_by = request.user
            log_work.adjusted_at = timezone.now()
            log_work.adjustment_reason = reason
            log_work.save(update_fields=[
                "hours_spent", "description", "adjusted_by", "adjusted_at",
                "adjustment_reason", "updated_at",
            ])

            rebuild_daily_user_timesheet(user_id=log_work.user_id, work_date=log_work.work_date)

            log_action(
                user=request.user,
                action="EDIT_LOG_WORK",
                table_name="log_works",
                record_id=log_work.id,
                old_values=old_values,
                new_values=snapshot(
                    log_work,
                    fields=["hours_spent", "description", "adjusted_by", "adjusted_at", "adjustment_reason"],
                ),
                request=request,
            )

        return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_200_OK)


class EmployeeMyLogWorkListView(APIView):
    """Retrieve chronologically ordered work log history created by the authenticated employee."""
    permission_classes = [HasPermission]
    required_permission = "timesheet:view"

    def get(self, request):
        """Return full list of personal work logs ordered by work date descending."""
        log_works = (
            LogWork.objects.filter(user=request.user)
            .select_related("task", "task__job")
            .order_by("-work_date", "-created_at")
        )
        serializer = EmployeeLogWorkListSerializer(log_works, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
