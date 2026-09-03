"""
Module: accounts.permissions
Description: Custom permission classes for role-based access control (RBAC).
"""

from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


class HasPermission(BasePermission):
    """Permission class verifying if the authenticated user's role possesses a specific permission code."""

    def __init__(self, required_permission=None):
        """Initialize permission with an optional explicit code."""
        self.required_permission = required_permission

    def has_permission(self, request, view):
        """Verify that the user is authenticated and has the required permission code assigned."""
        required_code = self.required_permission or getattr(view, 'required_permission', None)

        if required_code is None:
            raise AssertionError(
                f"{view.__class__.__name__} must set 'required_permission' as a class attribute "
                "or return HasPermission('code') from get_permissions()."
            )

        if not request.user or not request.user.is_authenticated:
            return False

        # Enforce password change before allowing further API actions
        if getattr(request.user, 'must_change_password', False):
            raise PermissionDenied("You must change your password before performing this action.")

        if request.user.role is None:
            return False

        return request.user.role.role_permissions.filter(
            permission__code=required_code
        ).exists()