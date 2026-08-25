from django.urls import path

from accounts.manager.views_manager import (
    ManagerDepartmentListView,
    ManagerTeamEmployeeListView,
)

urlpatterns = [
    # GET /api/manager/accounts/departments/
    path(
        "accounts/departments/",
        ManagerDepartmentListView.as_view(),
        name="manager-department-list",
    ),
    # GET /api/manager/accounts/employees/
    path(
        "accounts/employees/",
        ManagerTeamEmployeeListView.as_view(),
        name="manager-employee-list",
    ),
]
