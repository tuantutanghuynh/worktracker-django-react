"""
Module: system.security.permissions_manager
Description: Custom DRF permission classes enforcing role-based and permission-code-based authorization.
"""

from django.core.cache import cache
from rest_framework.permissions import BasePermission

from accounts.models import RolePermission


MANAGER_ROLE_CODE = "MANAGER"
ADMIN_ROLE_CODE = "ADMIN"

ROLE_PERMISSION_CACHE_KEY = "role_permissions:{role_id}"
ROLE_PERMISSION_CACHE_TIMEOUT = 300


def get_user_role_code(user):
    """Retrieve the role code string for a given user instance safely."""
    role = getattr(user, "role", None)
    return getattr(role, "code", None)


def get_permission_codes_for_role(role_id):
    """Retrieve and cache active permission codes assigned to a role ID."""
    cache_key = ROLE_PERMISSION_CACHE_KEY.format(role_id=role_id)
    cached_codes = cache.get(cache_key)

    if cached_codes is not None:
        return set(cached_codes)

    codes = list(
        RolePermission.objects.filter(role_id=role_id)
        .select_related("permission")
        .values_list("permission__code", flat=True)
    )

    cache.set(cache_key, codes, ROLE_PERMISSION_CACHE_TIMEOUT)
    return set(codes)


class IsActiveAuthenticated(BasePermission):
    """Allow access exclusively to authenticated and active users."""
    message = "User is not authenticated or account is inactive."

    def has_permission(self, request, view):
        """Check if request user is authenticated and active."""
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and user.is_active
        )


class IsManagerRole(BasePermission):
    """Allow access exclusively to users with the Manager role."""
    message = "Only Manager role is allowed."

    def has_permission(self, request, view):
        """Check if request user is authenticated and assigned the Manager role."""
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return get_user_role_code(user) == MANAGER_ROLE_CODE


class IsAdminRole(BasePermission):
    """Allow access exclusively to users with the Admin role."""
    message = "Only Admin role is allowed."

    def has_permission(self, request, view):
        """Check if request user is authenticated and assigned the Admin role."""
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return get_user_role_code(user) == ADMIN_ROLE_CODE


class IsAdminOrManagerRole(BasePermission):
    """Allow access to users possessing either Admin or Manager roles."""
    message = "Only Admin or Manager role is allowed."

    def has_permission(self, request, view):
        """Check if request user has either Admin or Manager role."""
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return get_user_role_code(user) in {
            ADMIN_ROLE_CODE,
            MANAGER_ROLE_CODE,
        }


class HasPermissionCode(BasePermission):
    """Check action-level permission codes against assigned role permissions."""
    message = "User does not have required permission."

    def has_permission(self, request, view):
        """Verify that user role contains required permission codes declared on view."""
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated or not user.is_active:
            return False

        role = getattr(user, "role", None)
        if role is None:
            return False

        required_permission = getattr(view, "required_permission", None)

        if not required_permission:
            return False

        user_permission_codes = get_permission_codes_for_role(role.id)

        if isinstance(required_permission, str):
            return required_permission in user_permission_codes

        if isinstance(required_permission, (list, tuple, set)):
            return any(
                code in user_permission_codes
                for code in required_permission
            )

        return False