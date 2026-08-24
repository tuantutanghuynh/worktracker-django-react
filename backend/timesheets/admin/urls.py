from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    AdminTimeLockViewSet,
    AdminTimesheetSummaryView,
    AdminTimesheetEmployeeListView,
    AdminTimesheetEmployeeDetailView,
    AdminTimesheetExportView,
)

router = DefaultRouter()

# ── TIMESHEET CONTROL ────────────────────────────────────────────────────────
# GET  /api/admin/timesheets/time-locks/          → GLOBAL-scope TimeLock history (quyền: timesheet:view)
# POST /api/admin/timesheets/time-locks/lock/     → { lock_month, lock_year, reason } khoá kỳ toàn hệ thống (quyền: timelock:global_manage)
# POST /api/admin/timesheets/time-locks/{id}/unlock/ → { reason } mở khoá (quyền: timelock:global_manage)
router.register('time-locks', AdminTimeLockViewSet, basename='admin-timelock')

urlpatterns = router.urls + [
    # GET /api/admin/timesheets/summary/?month=&year=
    # → 5 KPI card: total_logged_hours, active_employees, locked_periods_count,
    #   timesheet_violations, missing_timesheets (quyền: timesheet:view)
    path('summary/', AdminTimesheetSummaryView.as_view(), name='admin-timesheet-summary'),

    # GET /api/admin/timesheets/employees/?month=&year=&department=&manager=&search=&status=&page=
    # → Bảng giờ log theo từng nhân viên, company-wide (quyền: timesheet:view)
    path('employees/', AdminTimesheetEmployeeListView.as_view(), name='admin-timesheet-employees'),

    # GET /api/admin/timesheets/employees/export/?month=&year=&department=&manager=&search=&status=&ordering=
    # → Xuất Excel đúng bộ lọc đang áp dụng trên bảng (quyền: timesheet:export)
    path('employees/export/', AdminTimesheetExportView.as_view(), name='admin-timesheet-export'),

    # GET /api/admin/timesheets/employees/{user_id}/?month=&year=
    # → Compliance drill-down cho 1 nhân viên (quyền: timesheet:view)
    path('employees/<int:user_id>/', AdminTimesheetEmployeeDetailView.as_view(), name='admin-timesheet-employee-detail'),
]
