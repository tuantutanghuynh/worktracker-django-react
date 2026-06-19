from django.contrib import admin
from .models import AuditLog
# Register your models here.

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'action', 'table_name', 'user', 'record_id', 'ip_address', 'created_at')
    list_filter = ('action', 'table_name')
    search_fields = ('table_name', 'ip_address')
    randomly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj = ...):
        return False
    
    def has_delete_permission(self, request, obj = ...):
        return False