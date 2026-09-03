"""
Module: tasks.manager.urls_manager
Description: URL routing configuration for manager task management and Kanban endpoints.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from tasks.manager.views_manager import TaskViewSet, ManagerJobKanbanView

router = DefaultRouter()

router.register(
    r"tasks",
    TaskViewSet,
    basename="manager-tasks",
)

urlpatterns = [
    path(
        "jobs/<int:job_id>/kanban/",
        ManagerJobKanbanView.as_view(),
        name="manager-job-kanban",
    ),
]

urlpatterns += router.urls