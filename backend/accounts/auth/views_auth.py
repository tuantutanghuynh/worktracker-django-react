"""
Module: accounts.auth.views_auth
Description: Authentication API views handling login, logout, password recovery, and credential updates.
"""

import time
import redis
from django.conf import settings
from django.core.cache import caches
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.models import RolePermission
from system.utils import log_audit_event
from ..authentication import is_reauth_required
from .serializers_auth import (
    LoginSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ChangePasswordSerializer,
)

blacklist_cache = caches["blacklist"]


class ReauthAwareTokenRefreshView(TokenRefreshView):
    """Token refresh view validating permission change invalidation timestamps before refreshing."""

    def post(self, request, *args, **kwargs):
        """Process refresh token submission and check for forced re-authentication requirements."""
        raw_refresh = request.data.get("refresh")
        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
            except TokenError:
                token = None

            if token is not None:
                user_id = token.get("user_id")
                issued_at = token.get("iat", 0)
                if user_id and is_reauth_required(user_id, issued_at):
                    return Response(
                        {"detail": "Your permissions have changed. Please log in again.", "code": "reauth_required"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

        return super().post(request, *args, **kwargs)


class LoginView(APIView):
    """Public authentication endpoint verifying credentials and issuing JWT token pairs."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        """Authenticate user credentials and return access and refresh tokens."""
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tokens = serializer.get_tokens()
        return Response(tokens, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Authenticated endpoint revoking current access token via Redis blacklist."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Blacklist current token identifier in Redis until its natural expiration."""
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


class ForgotPasswordView(APIView):
    """Public endpoint generating a password reset token and dispatching email."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        """Process forgot password request and dispatch reset link email if account exists."""
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset = serializer.create_reset_token()

        if reset is not None:
            reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset.token}"
            send_mail(
                subject="Reset Password WorkTracker",
                message=f"Click the link below to reset your password:\n{reset_link}",
                from_email=None,
                recipient_list=[reset.email],
            )

        return Response(
            {"detail": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    """Public endpoint consuming a reset token to update the account password."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        """Verify reset token and update user password with audit logging."""
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


class ChangePasswordView(APIView):
    """Authenticated endpoint enabling users to change their password and reissue active tokens."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Validate current password, apply new password, and issue fresh JWT session tokens."""
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()

        # Invalidate existing refresh tokens across all sessions
        for outstanding in OutstandingToken.objects.filter(user=request.user):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        token = request.auth
        if token and "jti" in token:
            jti = token["jti"]
            ttl = token["exp"] - int(time.time())
            if ttl > 0:
                try:
                    blacklist_cache.set(f"blacklist:{jti}", "1", timeout=ttl)
                except redis.exceptions.RedisError:
                    pass

        log_audit_event(
            actor=request.user,
            action="CHANGE_PASSWORD",
            table_name="users",
            record_id=request.user.id,
            request=request,
        )

        refresh = RefreshToken.for_user(request.user)
        refresh["email"] = request.user.email
        refresh["role"] = request.user.role.code if request.user.role else None

        access = refresh.access_token

        perms = (
            list(
                RolePermission.objects.filter(role=request.user.role).values_list(
                    "permission__code", flat=True
                )
            )
            if request.user.role
            else []
        )

        return Response({
            "detail": "Password changed successfully.",
            "access": str(access),
            "refresh": str(refresh),
            "user": {
                "id": request.user.id,
                "email": request.user.email,
                "role": request.user.role.code if request.user.role else None,
                "must_change_password": False,
                "permissions": perms,
            },
        }, status=status.HTTP_200_OK)
