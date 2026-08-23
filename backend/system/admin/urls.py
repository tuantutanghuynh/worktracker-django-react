from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AuditLogViewSet, DashboardView, AdminReportView

router = DefaultRouter()

# ── AUDIT LOGS ────────────────────────────────────────────────────────────────
# GET /api/admin/audit-logs/        → Danh sách audit log, chỉ đọc (quyền: audit:view)
#     Filter params: ?actor=, ?actor_role=, ?action=, ?table_name=, ?date_from=, ?date_to=, ?record_id=, ?keyword=
# GET /api/admin/audit-logs/{id}/   → Chi tiết 1 audit log
# GET /api/admin/audit-logs/filters/ → { actions: [...], tables: [...] } — giá trị action/table_name
#     thực tế đang có trong bảng, dùng để đổ vào 2 dropdown filter phía frontend
router.register('audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = router.urls + [
    # GET /api/admin/dashboard/
    # → Thống kê tổng quan: active_clients, running_jobs, total_users, overdue_jobs,
    #   total_work_hours, jobs_by_status, clients_overview, task_status, audit_summary_today
    #   (quyền: audit:view)
    path('dashboard/', DashboardView.as_view(), name='dashboard'),

    # GET /api/admin/reports/
    # → Xuất file Excel gồm 3 sheet: Clients / Jobs / Users
    #   Sau khi export tự ghi audit log action='EXPORT' (quyền: report:export)
    path('reports/', AdminReportView.as_view(), name='admin-report'),
]
