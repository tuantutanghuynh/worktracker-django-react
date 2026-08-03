from django.urls import path

from system.employee.views_employee import NotificationListView, NotificationMarkReadView

# Notification routes shared by every authenticated role (not role-gated).
urlpatterns = [
    path("", NotificationListView.as_view(), name="notification_list"),
    path(
        "<int:notification_id>/read/",
        NotificationMarkReadView.as_view(),
        name="notification_mark_read",
    ),
]
