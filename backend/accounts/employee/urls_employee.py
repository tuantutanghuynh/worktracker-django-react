"""
Module: accounts.employee.urls_employee
Description: URL routing configuration for employee personal profile, avatar uploads, and KPI endpoints.
"""

from django.urls import path

from accounts.employee.views_employee import ProfileView, AvatarUploadView, PersonalKPIView

urlpatterns = [
    path("me/profile/", ProfileView.as_view(), name="my_profile"),
    path("me/profile/avatar/", AvatarUploadView.as_view(), name="my_profile_avatar"),
    path("me/kpi/", PersonalKPIView.as_view(), name="my_kpi"),
]
