from rest_framework import serializers

from system.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "event_type", "title", "content",
            "related_url", "is_read", "created_at",
        ]
        read_only_fields = fields
