from django.urls import path

from system.manager.views_manager import (
    ManagerAuditLogListView,
    ManagerNotificationListView,
    ManagerNotificationMarkAllReadView,
    ManagerNotificationMarkReadView,
)

urlpatterns = [
    # Notifications
    # GET /api/manager/system/notifications/
    path(
        "system/notifications/",
        ManagerNotificationListView.as_view(),
        name="manager-notification-list",
    ),
    # POST /api/manager/system/notifications/mark-all-read/
    # Đặt trước <int:notification_id> để tránh conflict routing
    path(
        "system/notifications/mark-all-read/",
        ManagerNotificationMarkAllReadView.as_view(),
        name="manager-notification-mark-all-read",
    ),
    # POST /api/manager/system/notifications/{id}/mark-read/
    path(
        "system/notifications/<int:notification_id>/mark-read/",
        ManagerNotificationMarkReadView.as_view(),
        name="manager-notification-mark-read",
    ),

    # Audit Logs
    # GET /api/manager/system/audit-logs/
    path(
        "system/audit-logs/",
        ManagerAuditLogListView.as_view(),
        name="manager-audit-log-list",
    ),
]
