from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

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

    # ── CHAT & MESSAGING SCOPE ────────────────────────────────────────────────
    path("api/chat/", include("chat.urls")),

    # ── SWAGGER / API DOCS ─────────────────────────────────────────────────────
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)