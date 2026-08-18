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
from timesheets.services.daily_total_manager_service import rebuild_daily_user_timesheet
from timesheets.models import LogWork

# This file holds the EMPLOYEE-only views for the timesheets app.


# Creates a log_work entry for a task assigned to the calling Employee.
class EmployeeLogWorkView(APIView):
    permission_classes = [HasPermission]
    required_permission = "timesheet:create"

    def post(self, request):
        serializer = EmployeeLogWorkSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        log_work = serializer.save()

        return Response(EmployeeLogWorkSerializer(log_work).data, status=status.HTTP_201_CREATED)


# Voids the caller's own log_work (soft-delete). Only PENDING entries can be
# voided — once a Manager has reviewed it, only the Manager-side review
# service can change its status.
class EmployeeVoidLogWorkView(APIView):
    permission_classes = [HasPermission]
    required_permission = "timesheet:void"

    def patch(self, request, log_work_id):
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError({"reason": "This field is required."})

        with transaction.atomic():
            log_work = get_object_or_404(
                LogWork.objects.select_for_update(),
                id=log_work_id,
                user_id=request.user.id,
            )

            if log_work.review_status != LogWork.ReviewStatus.PENDING:
                raise ValidationError("Only a PENDING log work can be voided.")

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

# Returns the calling user's own log_work history, newest first — powers
# the Timesheet page's list table. No filtering/pagination at this layer
# (dataset per user is small); FilterToolbar filters client-side, same
# approach as NotificationListView.
class EmployeeMyLogWorkListView(APIView):
    permission_classes = [HasPermission]
    required_permission = "timesheet:view"

    def get(self, request):
        log_works = (
            LogWork.objects.filter(user=request.user)
            .select_related("task", "task__job")
            .order_by("-work_date", "-created_at")
        )
        serializer = EmployeeLogWorkListSerializer(log_works, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
