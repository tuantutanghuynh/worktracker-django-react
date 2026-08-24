from django.urls import path

from timesheets.employee.views_employee import (
    EmployeeLogWorkView,
    EmployeeVoidLogWorkView,
    EmployeeEditLogWorkView,
    EmployeeMyLogWorkListView,
)

urlpatterns = [
    path("log-works/mine/", EmployeeMyLogWorkListView.as_view(), name="employee_log_work_list"),
    path("log-works/", EmployeeLogWorkView.as_view(), name="employee_log_work_create"),
    path("log-works/<int:log_work_id>/void/", EmployeeVoidLogWorkView.as_view(), name="employee_log_work_void"),
    path("log-works/<int:log_work_id>/edit/", EmployeeEditLogWorkView.as_view(), name="employee_log_work_edit"),
]
