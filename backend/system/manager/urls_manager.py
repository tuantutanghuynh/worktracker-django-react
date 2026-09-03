"""
Module: system.manager.urls_manager
Description: URL route patterns for manager-facing notification and audit log endpoints.
"""

from django.urls import path
from system.manager.views_manager import (
    ManagerAuditLogListView,
    ManagerNotificationBatchDeleteView,
    ManagerNotificationDeleteView,
    ManagerNotificationListView,
    ManagerNotificationMarkAllReadView,
    ManagerNotificationMarkReadView,
)

urlpatterns = [
    path(
        "system/notifications/",
        ManagerNotificationListView.as_view(),
        name="manager-notification-list",
    ),
    path(
        "system/notifications/mark-all-read/",
        ManagerNotificationMarkAllReadView.as_view(),
        name="manager-notification-mark-all-read",
    ),
    path(
        "system/notifications/delete-batch/",
        ManagerNotificationBatchDeleteView.as_view(),
        name="manager-notification-delete-batch",
    ),
    path(
        "system/notifications/<int:notification_id>/mark-read/",
        ManagerNotificationMarkReadView.as_view(),
        name="manager-notification-mark-read",
    ),
    path(
        "system/notifications/<int:notification_id>/",
        ManagerNotificationDeleteView.as_view(),
        name="manager-notification-delete",
    ),
    path(
        "system/audit-logs/",
        ManagerAuditLogListView.as_view(),
        name="manager-audit-log-list",
    ),
]
