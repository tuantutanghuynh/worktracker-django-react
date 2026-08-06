from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
import time
import redis
from django.core.cache import caches
from django.core.mail import send_mail
from system.utils import log_audit_event
from .serializers_auth import LoginSerializer, ForgotPasswordSerializer, ResetPasswordSerializer, ChangePasswordSerializer

blacklist_cache = caches["blacklist"]


# This file holds the views shared by every role for authentication:
# LoginView and LogoutView (issuing and revoking JWTs),
# ForgotPasswordView/ResetPasswordView (self-service password recovery via
# a one-time emailed token, see PasswordReset in models.py), and
# ChangePasswordView (set a new password while already logged in — used to
# satisfy must_change_password on CustomUser). Deliberately uses plain
# IsAuthenticated, not HasPermission, so it is never blocked by the
# must_change_password gate in permissions.py — see that file for why.


# Public endpoint: verifies email/password and issues an access + refresh token pair.
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tokens = serializer.get_tokens()
        return Response(tokens, status=status.HTTP_200_OK)


# Revokes the current access token immediately by blacklisting its jti in Redis,
# instead of waiting for it to expire naturally.
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.auth
        jti = token["jti"]
        ttl = token["exp"] - int(time.time())

        if ttl > 0:
            try:
                blacklist_cache.set(f"blacklist:{jti}", "1", timeout=ttl)
            except redis.exceptions.RedisError:
                return Response(
                    {"detail": "Logout service temporarily unavailable. Please try again."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)


# Public endpoint: always replies with the same 200 message, whether or not
# the email exists, and only emails a reset token when it does.
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset = serializer.creat_reset_token()

        if reset is not None:
            send_mail(
                subject="Reset Password WorkTracker",
                message=f"Use this token to reset password: {reset.token}",
                from_email=None,
                recipient_list=[reset.email],
            )

        return Response(
            {"detail": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


# Public endpoint: exchanges a valid, unused, non-expired reset token for a new password.
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.apply_new_password()

        log_audit_event(
            actor=user,
            action="RESET_PASSWORD",
            table_name="users",
            record_id=user.id,
            request=request,
        )

        return Response({"detail": "Password has been reset successfully"}, status=status.HTTP_200_OK)
# Authenticated endpoint: any logged-in user can change their own password.
# permission_classes is plain IsAuthenticated (not HasPermission) on purpose
# — see the file header above and permissions.py for why.
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()

        log_audit_event(
            actor=request.user,
            action="CHANGE_PASSWORD",
            table_name="users",
            record_id=request.user.id,
            request=request,
        )

        return Response({"detail": "Password changed successfully"}, status=status.HTTP_200_OK)