"""
Module: accounts.auth.urls_auth
Description: URL routing configuration for public and shared authentication endpoints.
"""

from django.urls import path

from .views_auth import (
    LoginView,
    LogoutView,
    ReauthAwareTokenRefreshView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", ReauthAwareTokenRefreshView.as_view(), name="token_refresh"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
