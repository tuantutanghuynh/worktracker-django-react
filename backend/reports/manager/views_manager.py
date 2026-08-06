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
    """
    GET /api/manager/dashboard/

    Dashboard của Manager:
    - Chỉ lấy dữ liệu trong jobs.manager_id = request.user.id
    - Không ghi dữ liệu nghiệp vụ
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
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
    """
    GET /api/manager/reports/task-summary/

    Báo cáo tổng hợp Task trong scope Manager:
    - job_id
    - assignee_id
    - status
    - priority
    - deadline_from
    - deadline_to
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
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
    """
    GET /api/manager/reports/timesheet-detail/

    Báo cáo chi tiết Timesheet trong scope Manager:
    - work_date_from
    - work_date_to
    - employee_id
    - department_id
    - job_id
    - task_id
    - task_status
    - review_status
    - locked_period_status
    - include_voided
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
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
    """
    POST /api/manager/reports/export/

    Export report ra file.

    Body mẫu:
        {
            "report_type": "TASK_SUMMARY",
            "file_format": "XLSX",
            "job_id": 1
        }

    Hoặc:
        {
            "report_type": "TIMESHEET_DETAIL",
            "file_format": "XLSX",
            "work_date_from": "2026-07-01",
            "work_date_to": "2026-07-31"
        }

    Ghi chú:
    - Export là thao tác read-only với dữ liệu nghiệp vụ.
    - Nhưng vẫn phải ghi AuditLog hành động REPORT_EXPORTED.
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:export"

    def post(self, request):
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