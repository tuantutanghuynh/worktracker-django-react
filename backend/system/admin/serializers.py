"""
Module: system.admin.serializers
Description: Serializers for system audit logs displayed in administration interfaces.
"""

from rest_framework import serializers
from ..models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serialize system audit log model instances for admin inspection."""
    class Meta:
        model = AuditLog
        fields = '__all__'
