"""
Module: timesheets.admin.serializers
Description: Serializer definitions for administration inspection of global time locks.
"""

from rest_framework import serializers
from timesheets.models import TimeLock


class GlobalTimeLockSerializer(serializers.ModelSerializer):
    """Serialize global period time-lock records for administrative management."""
    locked_by_email = serializers.CharField(source="locked_by.email", read_only=True)
    unlocked_by_email = serializers.CharField(source="unlocked_by.email", read_only=True, allow_null=True)

    class Meta:
        model = TimeLock
        fields = [
            "id", "lock_month", "lock_year", "is_locked",
            "locked_by", "locked_by_email", "locked_at", "lock_reason",
            "unlocked_by", "unlocked_by_email", "unlocked_at", "unlock_reason",
            "updated_at",
        ]
        read_only_fields = fields
