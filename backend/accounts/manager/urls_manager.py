"""
Module: accounts.manager.urls_manager
Description: URL routing configuration for manager-scoped department lookups and employee workloads.
"""

from django.urls import path

from accounts.manager.views_manager import (
    ManagerDepartmentListView,
    ManagerTeamEmployeeListView,
)

urlpatterns = [
    path(
        "accounts/departments/",
        ManagerDepartmentListView.as_view(),
        name="manager-department-list",
    ),
    path(
        "accounts/employees/",
        ManagerTeamEmployeeListView.as_view(),
        name="manager-employee-list",
    ),
]
