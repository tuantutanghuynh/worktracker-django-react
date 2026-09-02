from decimal import Decimal

from rest_framework import serializers

from projects.models import Job
from tasks.models import Task
from timesheets.models import LogWork, TimeLock, DailyUserTimesheet


class ManagerUserMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)

        if profile and profile.full_name:
            return profile.full_name

        return obj.email

    def get_avatar_url(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "avatar_url", None):
            return profile.avatar_url
        return None


class ManagerJobMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = [
            "id",
            "job_name",
            "status",
            "deadline",
        ]


class ManagerTaskMiniSerializer(serializers.ModelSerializer):
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
    adjusted_by = ManagerUserMiniSerializer(read_only=True)

    class Meta(ManagerLogWorkListSerializer.Meta):
        fields = ManagerLogWorkListSerializer.Meta.fields + [
            "adjusted_by",
            "adjusted_at",
            "adjustment_reason",
        ]


class ManagerLogWorkApproveSerializer(serializers.Serializer):
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )


class ManagerLogWorkRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_reason(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Reject reason is required."
            )

        return value


class ManagerLogWorkCorrectSerializer(serializers.Serializer):
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
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Adjustment reason is required."
            )

        return value

    def validate(self, attrs):
        if "hours_spent" not in attrs and "description" not in attrs:
            raise serializers.ValidationError(
                "At least one corrected field must be provided."
            )

        return attrs


class ManagerLogWorkVoidSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_reason(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Void reason is required."
            )

        return value


class ManagerTimeLockListSerializer(serializers.ModelSerializer):
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
    pass


class ManagerTimeLockCreateSerializer(serializers.Serializer):
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
    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_reason(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Unlock reason is required."
            )

        return value


class ManagerDailyUserTimesheetSerializer(serializers.ModelSerializer):
    user = ManagerUserMiniSerializer(read_only=True)

    class Meta:
        model = DailyUserTimesheet
        fields = [
            "id",
            "user",
            "work_date",
            "total_hours",
        ]


# ============================================================
# Compatibility serializer
# Giữ lại để file cũ không bị vỡ import nếu còn nơi nào import.
# Sau khi refactor toàn bộ timesheets xong có thể bỏ nếu không dùng.
# ============================================================

class TimeLockSerializer(serializers.ModelSerializer):
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