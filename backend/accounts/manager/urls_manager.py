from django.urls import path

from accounts.manager.views_manager import (
    ManagerDepartmentListView,
    ManagerEmployeeDepartmentUpdateView,
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
    # PATCH /api/manager/accounts/employees/{user_id}/department/
    path(
        "accounts/employees/<int:user_id>/department/",
        ManagerEmployeeDepartmentUpdateView.as_view(),
        name="manager-employee-department-update",
    ),
]
