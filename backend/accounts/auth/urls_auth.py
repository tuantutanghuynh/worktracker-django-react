from django.urls import path

from .views_auth import (
    LoginView,
    LogoutView,
    ReauthAwareTokenRefreshView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)

# Auth routes shared by every role — no role-specific permission required
# beyond holding a valid (non-blacklisted) JWT where applicable.
urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", ReauthAwareTokenRefreshView.as_view(), name="token_refresh"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
