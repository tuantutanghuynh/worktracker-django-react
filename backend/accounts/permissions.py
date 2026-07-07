from rest_framework.permissions import BasePermission

class HasPermission (BasePermission):
    def __init__(self, required_permission):
        self.required_permission = required_permission

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if not hasattr(user,'role') or user.role is None:
            return False
        return user.role.role_permissions.filter(permission__code=self.required_permission).exists()