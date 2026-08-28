from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from system.employee.views_employee import EmployeeAuditLogListView

urlpatterns = [
    path("admin/", admin.site.urls),

    # ── AUTHENTICATION (TuanTu) ────────────────────────────────────────────────
    path("api/auth/", include("accounts.auth.urls_auth")),

    # ── ADMIN SCOPE (MinhAnh) ──────────────────────────────────────────────────
    path("api/auth/", include("accounts.urls")),
    path("api/admin/", include("projects.urls")),
    path("api/admin/", include("system.urls")),
    path("api/admin/timesheets/", include("timesheets.admin.urls")),

    # ── MANAGER SCOPE (LongNguyen) ──────────────────────────────────────────────
    path("api/manager/", include("projects.manager.urls_manager")),
    path("api/manager/", include("tasks.manager.urls_manager")),
    path("api/manager/", include("timesheets.manager.urls_manager")),
    path("api/manager/", include("reports.manager.urls_manager")),
    path("api/manager/", include("accounts.manager.urls_manager")),
    path("api/manager/", include("system.manager.urls_manager")),

    # ── EMPLOYEE SCOPE (TuanTu) ────────────────────────────────────────────────
    path("api/employee/", include("accounts.employee.urls_employee")),
    path("api/employee/", include("tasks.employee.urls_employee")),
    path("api/timesheets/", include("timesheets.employee.urls_employee")),
    path("api/notifications/", include("system.employee.urls_employee")),
    path("api/employee/audit-logs/", EmployeeAuditLogListView.as_view(), name="employee-audit-log-list"),

    # ── CHAT & MESSAGING SCOPE ────────────────────────────────────────────────
    path("api/chat/", include("chat.urls")),

    # ── SWAGGER / API DOCS ─────────────────────────────────────────────────────
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]