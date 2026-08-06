from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
import secrets
from datetime import timedelta
from django.utils import timezone
from accounts.models import PasswordReset, RolePermission

User = get_user_model()

# This file holds the serializers shared by every role for authentication:
# login (JWT issuance), the forgot/reset password flow (token via email,
# no auth required), and changing your own password while logged in
# (ChangePasswordSerializer — different from reset: requires the current
# password, not a token). Each serializer here does double duty: validating
# the incoming data AND running the business logic needed to turn valid
# input into a result (tokens, a reset token, or a changed password).


# Validates email/password and issues JWT access/refresh tokens on success.
class LoginSerializer(serializers.Serializer):
    """Not based on TokenObtainPairSerializer: that class's authenticate()
    bundles wrong-credentials and inactive-account into a single error, but
    we need to tell them apart (401 vs 403)."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Declared upfront so the attribute always exists, even if
        # get_tokens() is ever called before validate() succeeds
        self.user = None

    # Authenticates the user; raises AuthenticationFailed (401) for bad credentials, PermissionDenied (403) if inactive.
    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = User.objects.filter(email=email).first()

        # Same message for "email not found" and "wrong password" so we
        # don't leak which emails exist in the system (anti user-enumeration)
        if user is None or not user.check_password(password):
            raise AuthenticationFailed("Invalid email or password.")

        # Kept separate: this is not a bad-input error, it's an
        # administrative block — frontend needs to show a different message
        if not user.is_active:
            raise PermissionDenied(
                "User account is disabled. Please contact the administrator."
            )

        self.user = user
        return attrs

    # Issues access + refresh tokens and returns them alongside the user payload for the frontend.
    def get_tokens(self):
        # Guard clause: fail fast with a clear reason if called out of
        # order, instead of letting Python raise a vague AttributeError below
        if self.user is None:
            raise RuntimeError(
                "get_tokens() called before successful validation. Ensure that validate() is called and passed before calling this method."
            )

        refresh = RefreshToken.for_user(self.user)

        # Custom claims must be set BEFORE reading access_token, since
        # access_token only copies claims already present on refresh at
        # the moment it's created
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
            # Returned alongside the tokens so the frontend can render
            # immediately without decoding the JWT itself
            "user": {
                "id": self.user.id,
                "email": self.user.email,
                "role": self.user.role.code if self.user.role else None,
                "must_change_password": self.user.must_change_password,
                "permissions": perms,
            },
        }


# Creates a one-time reset token for the given email, if that email exists.
# Returns None (no error) for unknown emails, so the view can always reply
# with the same message regardless — this isn't a place to leak which
# emails exist in the system.
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    # Generates a secure token, persists a PasswordReset record, and returns it (or None if email unknown).
    def creat_reset_token(self):
        email = self.validated_data["email"]
        user = User.objects.filter(email=email).first()

        if user is None:
            return None

        token = secrets.token_urlsafe(32)
        return PasswordReset.objects.create(
            email=email, token=token, expires_at=timezone.now() + timedelta(minutes=15)
        )


# Validates a reset token (exists, unused, not expired) and applies the new
# password on success. Unlike login, each failure case gets its own message
# since the token itself isn't guessable, so there's no enumeration risk.
class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.reset_record = None

    # Verifies the token exists, hasn't been used, and hasn't expired; stores the record for apply_new_password.
    def validate(self, attrs):
        reset = PasswordReset.objects.filter(token=attrs["token"]).first()

        if reset is None:
            raise serializers.ValidationError("Invalid Token")

        if reset.is_used:
            raise serializers.ValidationError("This reset link has already been used.")

        if reset.expires_at < timezone.now():
            raise serializers.ValidationError("This reset link has expired.")

        self.reset_record = reset
        return attrs

    # Applies the new password and marks the reset token as used to prevent reuse.
    def apply_new_password(self):
        if self.reset_record is None:
            raise RuntimeError(
                "apply_new_password() called before successful validation. "
                "Ensure that validate() is called and passed before calling this method."
            )

        user = User.objects.filter(email=self.reset_record.email).first()
        user.set_password(self.validated_data["new_password"])
        user.save()

        self.reset_record.is_used = True
        self.reset_record.save()

        return user
    
# Used by an already-authenticated user to set a new password (e.g. to
# satisfy must_change_password). Unlike ResetPasswordSerializer, there is
# no token here — request.user is already known, so this instead requires
# the CURRENT password as proof the caller really is that user.
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    # Confirms the current password is correct before allowing the change.
    def validate(self, attrs):
        user = self.context["request"].user

        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError("Current password is incorrect.")

        return attrs

    # Sets the new password and clears must_change_password so the user is no longer blocked.
    def apply_new_password(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.save()
