from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
import time
import redis
from django.core.cache import caches
from django.core.mail import send_mail
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from system.utils import log_audit_event
from ..authentication import is_reauth_required
from .serializers_auth import LoginSerializer, ForgotPasswordSerializer, ResetPasswordSerializer, ChangePasswordSerializer
from django.conf import settings

blacklist_cache = caches["blacklist"]


# This file holds the views shared by every role for authentication:
# LoginView and LogoutView (issuing and revoking JWTs),
# ForgotPasswordView/ResetPasswordView (self-service password recovery via
# a one-time emailed token, see PasswordReset in models.py), and
# ChangePasswordView (set a new password while already logged in — used to
# satisfy must_change_password on CustomUser). Deliberately uses plain
# IsAuthenticated, not HasPermission, so it is never blocked by the
# must_change_password gate in permissions.py — see that file for why.


# Wraps the default refresh endpoint with the same reauth check used for
# access tokens (WorkTrackerJWTAuthentication). Without this, a refresh
# token issued before a role change would just keep minting fresh access
# tokens forever, since TokenRefreshView never goes through our custom
# authentication class — require_reauth() alone would do nothing.
class ReauthAwareTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        raw_refresh = request.data.get("refresh")
        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
            except TokenError:
                token = None  # invalid/expired — let the parent view produce the normal error response

            if token is not None:
                user_id = token.get("user_id")
                issued_at = token.get("iat", 0)
                if user_id and is_reauth_required(user_id, issued_at):
                    return Response(
                        {"detail": "Your permissions have changed. Please log in again.", "code": "reauth_required"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

        return super().post(request, *args, **kwargs)


# Public endpoint: verifies email/password and issues an access + refresh token pair.
class LoginView(APIView):
    permission_classes = [AllowAny]
    # Gioi han 10 lan/phut moi IP — xem DEFAULT_THROTTLE_RATES.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

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
    # Endpoint cong khai, gui email that -> siet 5 lan/phut moi IP.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
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


# Public endpoint: exchanges a valid, unused, non-expired reset token for a new password.
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    # Endpoint cong khai, gui email that -> siet 5 lan/phut moi IP.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

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
from accounts.models import RolePermission

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()

        # Thu hồi mọi session: blacklist toàn bộ refresh token cũ của user này
        # (cùng model OutstandingToken/BlacklistedToken của simplejwt, dùng
        # cho "logout everywhere"), cộng thêm access token hiện tại — access
        # token không tự mất hiệu lực chỉ vì refresh token bị blacklist.
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
                    pass  # best-effort — đổi mật khẩu vẫn đã thành công, không rollback vì lỗi Redis

        log_audit_event(
            actor=request.user,
            action="CHANGE_PASSWORD",
            table_name="users",
            record_id=request.user.id,
            request=request,
        )

        # Cấp token mới cho phiên làm việc hiện tại, đưa thẳng vào Dashboard không cần đăng nhập lại
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
