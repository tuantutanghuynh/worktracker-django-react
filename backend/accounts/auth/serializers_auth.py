"""
Module: accounts.auth.serializers_auth
Description: Authentication serializers for user login, password recovery, and password changes.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
import secrets
import re
from datetime import timedelta
from django.utils import timezone
from accounts.models import PasswordReset, RolePermission
from django.db import transaction

User = get_user_model()


def validate_password_strength(value):
    """Validate password complexity against minimum length and character set requirements."""
    errors = []
    if len(value) < 8:
        errors.append("At least 8 characters")
    if not re.search(r"[a-z]", value):
        errors.append("Must contain a lowercase letter")
    if not re.search(r"[A-Z]", value):
        errors.append("Must contain an uppercase letter")
    if not re.search(r"[0-9]", value):
        errors.append("Must contain a number")
    if not re.search(r"[^A-Za-z0-9]", value):
        errors.append("Must contain a special symbol")
    return errors


class LoginSerializer(serializers.Serializer):
    """Serializer validating email/password credentials and generating JWT token pairs."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        """Normalize email address to lowercase for case-insensitive lookup."""
        return (value or "").strip().lower()

    def __init__(self, *args, **kwargs):
        """Initialize serializer state and default user attribute."""
        super().__init__(*args, **kwargs)
        self.user = None

    def validate(self, attrs):
        """Verify user credentials and check active status before issuing tokens."""
        email = attrs.get("email")
        password = attrs.get("password")

        user = User.objects.filter(email__iexact=email).first()

        if user is None or not user.check_password(password):
            raise AuthenticationFailed("Invalid email or password.")

        if not user.is_active:
            raise PermissionDenied(
                "User account is disabled. Please contact the administrator."
            )

        self.user = user
        return attrs

    def get_tokens(self):
        """Generate JWT access and refresh tokens including user payload and permission list."""
        if self.user is None:
            raise RuntimeError(
                "get_tokens() called before successful validation. Ensure that validate() is called and passed before calling this method."
            )

        refresh = RefreshToken.for_user(self.user)
        refresh["email"] = self.user.email
        refresh["role"] = self.user.role.code if self.user.role else None

        access = refresh.access_token

        perms = (
            list(
                RolePermission.objects.filter(role=self.user.role).values_list(
                    "permission__code", flat=True
                )
            )
            if self.user.role
            else []
        )

        return {
            "access": str(access),
            "refresh": str(refresh),
            "user": {
                "id": self.user.id,
                "email": self.user.email,
                "role": self.user.role.code if self.user.role else None,
                "must_change_password": self.user.must_change_password,
                "permissions": perms,
            },
        }


class ForgotPasswordSerializer(serializers.Serializer):
    """Serializer creating a one-time password reset verification token for requested email."""

    email = serializers.EmailField()

    def validate_email(self, value):
        """Normalize email address to lowercase for case-insensitive lookup."""
        return (value or "").strip().lower()

    def create_reset_token(self):
        """Generate a secure token and store a PasswordReset record if the user exists."""
        email = self.validated_data["email"]
        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            return None

        token = secrets.token_urlsafe(32)
        return PasswordReset.objects.create(
            email=email, token=token, expires_at=timezone.now() + timedelta(minutes=15)
        )


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer validating password reset token and setting a new account password."""

    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        """Initialize serializer state and reset record holder."""
        super().__init__(*args, **kwargs)
        self.reset_record = None

    def validate_new_password(self, value):
        """Validate complexity of the provided new password."""
        errors = validate_password_strength(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, attrs):
        """Verify token validity, expiration, and unused status."""
        reset = PasswordReset.objects.filter(token=attrs["token"]).first()

        if reset is None:
            raise serializers.ValidationError("Invalid Token")

        if reset.is_used:
            raise serializers.ValidationError("This reset link has already been used.")

        if reset.expires_at < timezone.now():
            raise serializers.ValidationError("This reset link has expired.")

        self.reset_record = reset
        return attrs

    def apply_new_password(self):
        """Apply new password atomically with a database lock to prevent race conditions."""
        if self.reset_record is None:
            raise RuntimeError(
                "apply_new_password() called before successful validation. "
                "Ensure that validate() is called and passed before calling this method."
            )

        with transaction.atomic():
            reset = PasswordReset.objects.select_for_update().get(pk=self.reset_record.pk)

            if reset.is_used:
                raise serializers.ValidationError("This reset link has already been used.")
            if reset.expires_at < timezone.now():
                raise serializers.ValidationError("This reset link has expired.")

            user = User.objects.filter(email__iexact=reset.email).first()
            user.set_password(self.validated_data["new_password"])
            user.save()

            reset.is_used = True
            reset.save()

        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer handling in-session password updates for authenticated users."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        """Validate complexity of the provided new password."""
        errors = validate_password_strength(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value

    def validate(self, attrs):
        """Verify that the provided current password is correct."""
        user = self.context["request"].user

        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError("Current password is incorrect.")

        return attrs

    def apply_new_password(self):
        """Apply new password and clear the must_change_password flag for current user."""
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.save()
