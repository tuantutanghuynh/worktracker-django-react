"""
Module: reports.manager.views_manager
Description: Manager API views for dashboard metrics, task summary reports, timesheet details, and file exports.
"""

from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from reports.manager.serializers_manager import (
    ManagerDashboardQuerySerializer,
    ManagerReportExportQuerySerializer,
    ManagerTaskSummaryReportQuerySerializer,
    ManagerTimesheetDetailReportQuerySerializer,
)
from reports.services.manager_dashboard_service import build_dashboard
from reports.services.manager_task_summary_report_service import (
    build_task_summary_report,
)
from reports.services.manager_timesheet_detail_report_service import (
    build_timesheet_detail_report,
)
from reports.services.manager_report_export_service import (
    export_manager_report,
)

from system.security.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode


class ManagerDashboardView(APIView):
    """View compiling manager dashboard analytics including job health, task metrics, and employee utilization."""

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
        """Retrieve aggregated dashboard metrics for requested month and year."""
        today = timezone.localdate()

        data = {
            "month": request.query_params.get("month", today.month),
            "year": request.query_params.get("year", today.year),
        }

        serializer = ManagerDashboardQuerySerializer(data=data)
        serializer.is_valid(raise_exception=True)

        dashboard = build_dashboard(
            user=request.user,
            month=serializer.validated_data["month"],
            year=serializer.validated_data["year"],
        )

        return Response(
            dashboard,
            status=status.HTTP_200_OK,
        )


class ManagerTaskSummaryReportView(APIView):
    """View generating task summary reports across statuses, assignees, and deadlines within manager scope."""

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
        """Generate filtered task summary report data."""
        serializer = ManagerTaskSummaryReportQuerySerializer(
            data=request.query_params,
        )
        serializer.is_valid(raise_exception=True)

        report_data = build_task_summary_report(
            user=request.user,
            filters=serializer.validated_data,
        )

        return Response(
            report_data,
            status=status.HTTP_200_OK,
        )


class ManagerTimesheetDetailReportView(APIView):
    """View generating granular timesheet work log reports within manager scope."""

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
        """Generate filtered timesheet work log report data."""
        serializer = ManagerTimesheetDetailReportQuerySerializer(
            data=request.query_params,
        )
        serializer.is_valid(raise_exception=True)

        report_data = build_timesheet_detail_report(
            user=request.user,
            filters=serializer.validated_data,
        )

        return Response(
            report_data,
            status=status.HTTP_200_OK,
        )


class ManagerReportExportView(APIView):
    """View exporting task summary and timesheet reports to formatted file spreadsheets."""

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:export"

    def post(self, request):
        """Export report dataset and return downloadable file response with audit logging."""
        serializer = ManagerReportExportQuerySerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        exported_file = export_manager_report(
            user=request.user,
            filters=serializer.validated_data,
            request=request,
        )

        response = HttpResponse(
            exported_file["content"],
            content_type=exported_file["content_type"],
        )

        response["Content-Disposition"] = (
            f'attachment; filename="{exported_file["filename"]}"'
        )

        return response