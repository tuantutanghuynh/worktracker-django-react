"""
Module: system.employee.urls_employee
Description: URL route definitions for employee-facing notification endpoints.
"""

from django.urls import path
from system.employee.views_employee import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification_list"),
    path(
        "mark-all-read/",
        NotificationMarkAllReadView.as_view(),
        name="notification_mark_all_read",
    ),
    path(
        "<int:notification_id>/read/",
        NotificationMarkReadView.as_view(),
        name="notification_mark_read",
    ),
]
