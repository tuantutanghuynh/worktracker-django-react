"""
Module: system.admin
Description: Django admin panel registrations and read-only protections for system audit logs.
"""

from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Provides read-only audit log inspection within the Django admin panel."""
    list_display = ('id', 'action', 'table_name', 'user', 'record_id', 'ip_address', 'created_at')
    list_filter = ('action', 'table_name')
    search_fields = ('table_name', 'ip_address')
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        """Prevent manual creation of audit log records."""
        return False

    def has_change_permission(self, request, obj=...):
        """Prevent modification of immutable audit log records."""
        return False

    def has_delete_permission(self, request, obj=...):
        """Prevent deletion of audit log records."""
        return False
