from rest_framework import serializers

from system.models import Notification, AuditLog


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "event_type", "title", "content",
            "related_url", "is_read", "created_at",
        ]
        read_only_fields = fields


class EmployeeAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id", "action", "severity", "summary", "table_name",
            "record_id", "old_values", "new_values", "ip_address", "created_at",
        ]
        read_only_fields = fields
