from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views_auth import LoginView, LogoutView, ForgotPasswordView, ResetPasswordView, ChangePasswordView

# Auth routes shared by every role — no role-specific permission required
# beyond holding a valid (non-blacklisted) JWT where applicable.
urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
