"""
Module: accounts.admin
Description: Django admin panel registrations for IAM, roles, permissions, users, and departments.
"""

from django.contrib import admin
from .models import CustomUser, Department, EmployeeProfile, PasswordReset, Permission, Role, RolePermission


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """Admin configuration for system role entities."""
    list_display = ('id', 'code', 'name')
    search_fields = ('code', 'name')


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    """Admin configuration for system permission actions."""
    list_display = ('id', 'code', 'name')
    search_fields = ('code', 'name')


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    """Admin configuration for role-permission association mappings."""
    list_display = ('id', 'role', 'permission')
    list_filter = ('role',)


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    """Admin configuration for email-based user accounts."""
    list_display = ('id', 'email', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email',)


@admin.register(PasswordReset)
class PasswordResetAdmin(admin.ModelAdmin):
    """Admin configuration for password reset verification tokens."""
    list_display = ('id', 'email', 'is_used', 'expires_at', 'created_at')
    search_fields = ('email',)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Admin configuration for organizational departments."""
    list_display = ('id', 'name', 'manager')
    search_fields = ('name',)


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    """Admin configuration for extended employee profile information."""
    list_display = ('user', 'full_name', 'phone_number', 'department')
    search_fields = ('full_name', 'phone_number')
