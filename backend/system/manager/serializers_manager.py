from rest_framework import serializers

from system.models import AuditLog, Notification


# ============================================================
# Serializer Notification
# ============================================================
class ManagerNotificationSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(
        source="get_event_type_display",
        read_only=True,
    )
    type_display = serializers.CharField(
        source="get_type_display",
        read_only=True,
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "event_type",
            "event_type_display",
            "type",
            "type_display",
            "title",
            "content",
            "related_url",
            "is_read",
            "is_sent_email",
            "sent_at",
            "created_at",
        ]
        read_only_fields = fields


# ============================================================
# Serializer AuditLog
# ============================================================
class ManagerAuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(
        source="user.email",
        read_only=True,
        default=None,
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_email",
            "action",
            "table_name",
            "record_id",
            "old_values",
            "new_values",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields
