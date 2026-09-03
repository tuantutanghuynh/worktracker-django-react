"""
Module: system.manager.serializers_manager
Description: Serializers for manager-scoped notifications and audit logs.
"""

from rest_framework import serializers
from system.models import AuditLog, Notification


class ManagerNotificationSerializer(serializers.ModelSerializer):
    """Serialize notification instances for manager dashboard views."""
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


class ManagerAuditLogSerializer(serializers.ModelSerializer):
    """Serialize audit log instances within the manager's authorized operational scope."""
    actor_email = serializers.EmailField(
        source="user.email",
        read_only=True,
        default=None,
    )
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_email",
            "actor_name",
            "action",
            "severity",
            "summary",
            "table_name",
            "record_id",
            "old_values",
            "new_values",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        """Extract human-readable actor name or email prefix from audit record user."""
        if not obj.user:
            return "System"
        profile = getattr(obj.user, "profile", None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.user.email.split("@")[0]
