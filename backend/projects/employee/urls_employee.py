"""
Module: projects.employee.urls_employee
Description: URL routing configuration for employee project team endpoints.
"""

from django.urls import path
from projects.employee.views_employee import EmployeeMyTeamView

urlpatterns = [
    path("team/", EmployeeMyTeamView.as_view(), name="employee-my-team"),
]
