"""
Module: system.admin.serializers
Description: Serializers for system audit logs displayed in administration interfaces.
"""

from rest_framework import serializers
from ..models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serialize system audit log model instances for admin inspection."""

    # Truong `user` chi la id. Khong co ten/email di kem thi cau tom tat o
    # frontend (utils/auditLabels.js -> summarizeLog) phai ghi truong "User"
    # thay cho nguoi that su thuc hien — vo nghia voi mot ban ghi kiem toan.
    actor_email = serializers.SerializerMethodField(read_only=True)
    actor_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'

    def get_actor_email(self, obj):
        """Return the email of the user who performed the action."""
        return obj.user.email if obj.user else None

    def get_actor_name(self, obj):
        """Return the full name of the acting user, when a profile exists."""
        if not obj.user:
            return None
        return getattr(getattr(obj.user, 'profile', None), 'full_name', None) or None
