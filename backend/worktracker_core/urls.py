"""
Module: worktracker_core.urls
Description: Root URL configuration and API route dispatching across authentication, role scopes, and documentation.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from system.employee.views_employee import EmployeeAuditLogListView
from tasks.views_attachments import TaskAttachmentDownloadView

urlpatterns = [
    path("admin/", admin.site.urls),

    # Authentication routes
    path("api/auth/", include("accounts.auth.urls_auth")),

    # Admin scope routes
    path("api/auth/", include("accounts.urls")),
    path("api/admin/", include("projects.urls")),
    path("api/admin/", include("system.urls")),
    path("api/admin/timesheets/", include("timesheets.admin.urls")),

    # Manager scope routes
    path("api/manager/", include("projects.manager.urls_manager")),
    path("api/manager/", include("tasks.manager.urls_manager")),
    path("api/manager/", include("timesheets.manager.urls_manager")),
    path("api/manager/", include("reports.manager.urls_manager")),
    path("api/manager/", include("accounts.manager.urls_manager")),
    path("api/manager/", include("system.manager.urls_manager")),

    # Employee scope routes
    path("api/employee/", include("accounts.employee.urls_employee")),
    path("api/employee/", include("tasks.employee.urls_employee")),
    path("api/employee/", include("projects.employee.urls_employee")),
    path("api/timesheets/", include("timesheets.employee.urls_employee")),
    path("api/notifications/", include("system.employee.urls_employee")),
    path("api/employee/audit-logs/", EmployeeAuditLogListView.as_view(), name="employee-audit-log-list"),

    # Chat and realtime messaging routes
    path("api/chat/", include("chat.urls")),

    # Tai file dinh kem: diem vao duy nhat, co kiem tra quyen theo du an.
    path(
        "api/attachments/<int:attachment_id>/download/",
        TaskAttachmentDownloadView.as_view(),
        name="task-attachment-download",
    ),

    # API Documentation schemas
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

# /media/ CHI con phuc vu anh dai dien.
#
# Truoc day dong nay phuc vu ca thu muc MEDIA_ROOT ma khong xac thuc gi, nen
# moi file dinh kem cua moi du an deu tai duoc bang mot URL doan ra — khong can
# dang nhap. Gio file dinh kem chi di qua TaskAttachmentDownloadView, noi co
# kiem tra nguoi goi co thuoc du an do khong.
#
# Anh dai dien van de mo: no do chinh nguoi dung tu tai len de hien cong khai
# trong he thong, ten file la UUID nen khong do duoc, va no duoc nhung bang
# <img src> o hang chuc cho — bat xac thuc se phai doi toan bo cho do sang tai
# bang blob, doi lai rat it.
urlpatterns += [
    re_path(
        r"^media/(?P<path>avatars/.*)$",
        serve,
        {"document_root": settings.MEDIA_ROOT},
    ),
]