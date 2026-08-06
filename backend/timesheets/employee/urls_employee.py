from django.urls import path

from timesheets.employee.views_employee import EmployeeLogWorkView, EmployeeVoidLogWorkView

# Employee-facing timesheet routes.
urlpatterns = [
    path("log-works/", EmployeeLogWorkView.as_view(), name="employee_log_work_create"),
    path("log-works/<int:log_work_id>/void/", EmployeeVoidLogWorkView.as_view(), name="employee_log_work_void"),
]
