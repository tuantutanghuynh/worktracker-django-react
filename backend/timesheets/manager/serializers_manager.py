"""
Module: timesheets.manager.serializers_manager
Description: Serializer definitions for manager timesheet review, work log adjustments, and job period locks.
"""

from decimal import Decimal
from rest_framework import serializers

from projects.models import Job
from tasks.models import Task
from timesheets.models import LogWork, TimeLock, DailyUserTimesheet


class ManagerUserMiniSerializer(serializers.Serializer):
    """Serialize minimal user details including full name and avatar URL for manager views."""
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        """Extract display name from user profile or fallback to email."""
        profile = getattr(obj, "profile", None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.email

    def get_avatar_url(self, obj):
        """Extract avatar URL from user profile if present."""
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "avatar_url", None):
            return profile.avatar_url
        return None


class ManagerJobMiniSerializer(serializers.ModelSerializer):
    """Serialize minimal job metadata for embedded relationship displays."""
    class Meta:
        model = Job
        fields = [
            "id",
            "job_name",
            "status",
            "deadline",
        ]


class ManagerTaskMiniSerializer(serializers.ModelSerializer):
    """Serialize minimal task details along with parent job info."""
    job = ManagerJobMiniSerializer(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "status",
            "deadline",
            "job",
        ]


class ManagerLogWorkListSerializer(serializers.ModelSerializer):
    """Serialize work log entries in list views with associated task, submitter, and reviewer."""
    task = ManagerTaskMiniSerializer(read_only=True)
    user = ManagerUserMiniSerializer(read_only=True)
    reviewed_by = ManagerUserMiniSerializer(read_only=True)

    class Meta:
        model = LogWork
        fields = [
            "id",
            "task",
            "user",
            "work_date",
            "hours_spent",
            "description",
            "review_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "created_at",
            "updated_at",
        ]


class ManagerLogWorkDetailSerializer(ManagerLogWorkListSerializer):
    """Serialize comprehensive work log details including adjustment metadata."""
    adjusted_by = ManagerUserMiniSerializer(read_only=True)

    class Meta(ManagerLogWorkListSerializer.Meta):
        fields = ManagerLogWorkListSerializer.Meta.fields + [
            "adjusted_by",
            "adjusted_at",
            "adjustment_reason",
        ]


class ManagerLogWorkApproveSerializer(serializers.Serializer):
    """Validate optional review notes when approving a work log."""
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )


class ManagerLogWorkRejectSerializer(serializers.Serializer):
    """Validate mandatory rejection reason when rejecting a work log."""
    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_reason(self, value):
        """Ensure rejection reason string is not empty or whitespace-only."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Reject reason is required."
            )
        return value


class ManagerLogWorkCorrectSerializer(serializers.Serializer):
    """Validate hour corrections, updated descriptions, and required adjustment reason."""
    hours_spent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=Decimal("8.00"),
        required=False,
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )
    adjustment_reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_adjustment_reason(self, value):
        """Ensure adjustment reason is provided."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Adjustment reason is required."
            )
        return value

    def validate(self, attrs):
        """Ensure that at least one field to correct is provided."""
        if "hours_spent" not in attrs and "description" not in attrs:
            raise serializers.ValidationError(
                "At least one corrected field must be provided."
            )
        return attrs


class ManagerLogWorkVoidSerializer(serializers.Serializer):
    """Validate mandatory void reason string when voiding a work log."""
    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_reason(self, value):
        """Ensure void reason is non-empty."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Void reason is required."
            )
        return value


class ManagerTimeLockListSerializer(serializers.ModelSerializer):
    """Serialize job-scoped time locks for manager period management."""
    job = ManagerJobMiniSerializer(read_only=True)
    locked_by = ManagerUserMiniSerializer(read_only=True)
    unlocked_by = ManagerUserMiniSerializer(read_only=True)

    class Meta:
        model = TimeLock
        fields = [
            "id",
            "lock_month",
            "lock_year",
            "lock_scope",
            "job",
            "is_locked",
            "locked_by",
            "locked_at",
            "lock_reason",
            "unlocked_by",
            "unlocked_at",
            "unlock_reason",
            "updated_at",
        ]


class ManagerTimeLockDetailSerializer(ManagerTimeLockListSerializer):
    """Serialize detailed job-scoped time lock records."""
    pass


class ManagerTimeLockCreateSerializer(serializers.Serializer):
    """Validate incoming payload to lock a monthly period for a specific project."""
    job_id = serializers.IntegerField()
    lock_month = serializers.IntegerField(min_value=1, max_value=12)
    lock_year = serializers.IntegerField(min_value=2000)
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )


class ManagerTimeLockUnlockSerializer(serializers.Serializer):
    """Validate required unlock reason when unlocking a job period."""
    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_reason(self, value):
        """Ensure unlock reason is non-empty."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Unlock reason is required."
            )
        return value


class ManagerDailyUserTimesheetSerializer(serializers.ModelSerializer):
    """Serialize daily aggregated timesheets for team member workload tracking."""
    user = ManagerUserMiniSerializer(read_only=True)

    class Meta:
        model = DailyUserTimesheet
        fields = [
            "id",
            "user",
            "work_date",
            "total_hours",
        ]


class TimeLockSerializer(serializers.ModelSerializer):
    """Compatibility serializer for generic time lock instances."""
    class Meta:
        model = TimeLock
        fields = [
            "id",
            "lock_month",
            "lock_year",
            "lock_scope",
            "job",
            "is_locked",
            "locked_by",
            "locked_at",
            "lock_reason",
            "unlocked_by",
            "unlocked_at",
            "unlock_reason",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "lock_scope",
            "is_locked",
            "locked_by",
            "locked_at",
            "unlocked_by",
            "unlocked_at",
            "unlock_reason",
            "updated_at",
        ]