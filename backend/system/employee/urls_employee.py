from django.urls import path

from system.employee.views_employee import (
    NotificationListView, NotificationMarkReadView, NotificationMarkAllReadView,
)

# Notification routes shared by every authenticated role (not role-gated).
urlpatterns = [
    path("", NotificationListView.as_view(), name="notification_list"),
    # Placed before <int:notification_id>/ so "mark-all-read" is never
    # mistaken for that pattern (matches the ordering Manager's routes use).
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
