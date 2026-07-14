from django.urls import path

from reports.views_manager import (
    ManagerDashboardView,
    ManagerReportExportView,
    ManagerTaskSummaryReportView,
    ManagerTimesheetDetailReportView,
)


urlpatterns = [
    path(
        "dashboard/",
        ManagerDashboardView.as_view(),
        name="manager-dashboard",
    ),
    path(
        "reports/task-summary/",
        ManagerTaskSummaryReportView.as_view(),
        name="manager-task-summary-report",
    ),
    path(
        "reports/timesheet-detail/",
        ManagerTimesheetDetailReportView.as_view(),
        name="manager-timesheet-detail-report",
    ),
    path(
        "reports/export/",
        ManagerReportExportView.as_view(),
        name="manager-report-export",
    ),
]