from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AuditLogViewSet, DashboardView, DataQualityAlertsView

router = DefaultRouter()

# ── AUDIT LOGS ────────────────────────────────────────────────────────────────
# GET /api/admin/audit-logs/        → Danh sách audit log, chỉ đọc (quyền: audit:view)
#     Filter params: ?actor=, ?actor_role=, ?action=, ?table_name=, ?severity=, ?date_from=, ?date_to=, ?record_id=, ?keyword=
# GET /api/admin/audit-logs/{id}/   → Chi tiết 1 audit log
# GET /api/admin/audit-logs/filters/ → { actions: [...], tables: [...] } — giá trị action/table_name
#     thực tế đang có trong bảng, dùng để đổ vào 2 dropdown filter phía frontend
# GET /api/admin/audit-logs/summary/ → 5 KPI card cho trang Audit Logs, scope theo ?actor_role= + hôm nay
# GET /api/admin/audit-logs/export/  → Xuất Excel đúng bộ lọc đang áp dụng (quyền: audit:export)
router.register('audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = router.urls + [
    # GET /api/admin/dashboard/
    # → Thống kê tổng quan: active_clients, total_users, active_accounts, locked_accounts,
    #   departments_without_manager, overdue_jobs, total_work_hours, pending_timesheets,
    #   jobs_by_status, clients_overview, audit_summary_today, recent_security_events
    #   (quyền: audit:view) — cache server-side 30s
    path('dashboard/', DashboardView.as_view(), name='dashboard'),

    # GET /api/admin/data-quality-alerts/
    # → Danh sách cảnh báo tổng hợp real-time (không lưu DB): Department chưa có
    #   manager, Employee chưa gán department, Client thiếu contact info. Mỗi item
    #   có related_url để frontend mở thẳng modal sửa (?edit=<id>) (quyền: audit:view)
    path('data-quality-alerts/', DataQualityAlertsView.as_view(), name='data-quality-alerts'),
]
