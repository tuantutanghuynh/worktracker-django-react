from django.urls import path

from projects.employee.views_employee import EmployeeMyTeamView

urlpatterns = [
    path("team/", EmployeeMyTeamView.as_view(), name="employee-my-team"),
]
