"""
Module: tasks.manager.serializers_manager
Description: Serializers for manager task lists, detail views, creation, editing, Kanban moves, comments, and attachments.
"""

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from projects.models import Job
from tasks.models import Task, TaskComment, TaskAttachment
from tasks.services.task_deadline_calculator_service import calculate_task_deadline_health


class ManagerUserMiniSerializer(serializers.Serializer):
    """Compact serializer representing basic user identity, role, and avatar."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    role = serializers.CharField(source="role.code", read_only=True)
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        """Return full name from profile or fallback to email."""
        profile = getattr(obj, "profile", None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.email

    def get_avatar_url(self, obj):
        """Return avatar image URL from user profile."""
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "avatar_url", None):
            return profile.avatar_url
        return None


class ManagerJobMiniSerializer(serializers.ModelSerializer):
    """Compact serializer representing parent project job details and client status."""

    client_name = serializers.CharField(source="client.client_name", read_only=True)
    client_is_active = serializers.BooleanField(source="client.is_active", read_only=True)

    class Meta:
        model = Job
        fields = [
            "id",
            "job_name",
            "status",
            "deadline",
            "client_name",
            "client_is_active",
        ]


class ManagerTaskListSerializer(serializers.ModelSerializer):
    """Serializer representing task list items with calculated deadline health and metadata counts."""

    job = ManagerJobMiniSerializer(read_only=True)
    assignee = ManagerUserMiniSerializer(read_only=True)
    is_overdue = serializers.SerializerMethodField()
    deadline_health = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    rejection_count = serializers.SerializerMethodField()
    latest_rejection = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "priority",
            "status",
            "deadline",
            "job",
            "assignee",
            "order_index",
            "is_overdue",
            "deadline_health",
            "comment_count",
            "attachment_count",
            "rejection_count",
            "latest_rejection",
        ]

    def get_is_overdue(self, obj):
        """Determine whether task has passed deadline while incomplete."""
        return (
            obj.deadline < timezone.localdate()
            and obj.status not in [
                Task.Status.COMPLETED,
                Task.Status.CANCELLED,
            ]
        )

    def get_deadline_health(self, obj):
        """Calculate dynamic deadline health dictionary for task."""
        return calculate_task_deadline_health(obj)

    def get_comment_count(self, obj):
        """Return total count of discussion comments on task."""
        if hasattr(obj, "comment_count"):
            return obj.comment_count
        return obj.comments.count()

    def get_attachment_count(self, obj):
        """Return total count of attached files on task."""
        if hasattr(obj, "attachment_count"):
            return obj.attachment_count
        return obj.attachments.count()

    def get_rejection_count(self, obj):
        """Return total count of rejection comments on task."""
        return obj.comments.filter(
            Q(comment_type=TaskComment.CommentType.REJECTION_NOTE)
            | Q(content__startswith="[Rejection Note]")
            | Q(content__startswith="[Rework Requested]")
        ).count()

    def get_latest_rejection(self, obj):
        """Return details of most recent task rejection note."""
        comment = (
            obj.comments.filter(
                Q(comment_type=TaskComment.CommentType.REJECTION_NOTE)
                | Q(content__startswith="[Rejection Note]")
                | Q(content__startswith="[Rework Requested]")
            )
            .select_related("user", "user__profile")
            .order_by("-created_at")
            .first()
        )
        if comment:
            reason = (
                comment.content.replace("[Rejection Note]: ", "")
                .replace("[Rework Requested]: ", "")
                .strip()
            )
            user_name = (
                getattr(getattr(comment.user, "profile", None), "full_name", "")
                or comment.user.email
            )
            return {
                "id": comment.id,
                "reason": reason,
                "rejected_by": user_name,
                "rejected_at": comment.created_at,
            }
        return None


class ManagerTaskDetailSerializer(ManagerTaskListSerializer):
    """Detailed serializer for single task inspection in manager views."""

    job = ManagerJobMiniSerializer(read_only=True)
    creator = ManagerUserMiniSerializer(read_only=True)
    rejection_history = serializers.SerializerMethodField()

    class Meta(ManagerTaskListSerializer.Meta):
        fields = ManagerTaskListSerializer.Meta.fields + [
            "description",
            "job",
            "creator",
            "completed_at",
            "rejection_history",
            "created_at",
            "updated_at",
        ]

    def get_rejection_history(self, obj):
        """Return complete chronological list of rejection notes for task."""
        comments = (
            obj.comments.filter(
                Q(comment_type=TaskComment.CommentType.REJECTION_NOTE)
                | Q(content__startswith="[Rejection Note]")
                | Q(content__startswith="[Rework Requested]")
            )
            .select_related("user", "user__profile")
            .order_by("-created_at")
        )
        return [
            {
                "id": c.id,
                "reason": c.content.replace("[Rejection Note]: ", "")
                .replace("[Rework Requested]: ", "")
                .strip(),
                "rejected_by": getattr(
                    getattr(c.user, "profile", None), "full_name", ""
                )
                or c.user.email,
                "rejected_at": c.created_at,
                "comment_type": c.comment_type,
            }
            for c in comments
        ]


class ManagerTaskCreateSerializer(serializers.Serializer):
    """Serializer validating parameters for new task creation by manager."""

    job_id = serializers.IntegerField()
    assignee_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    priority = serializers.ChoiceField(
        choices=Task.Priority.choices,
        default=Task.Priority.MEDIUM,
    )
    deadline = serializers.DateField()

    def validate_title(self, value):
        """Validate non-empty task title."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Task title is required.")
        return value

    def validate_deadline(self, value):
        """Ensure task deadline is not set in past."""
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError(
                f"Task deadline cannot be in the past (must be on or after {today})."
            )
        return value

    def validate_assignee_id(self, value):
        """Ensure assigned user is active employee."""
        if value:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.filter(id=value, is_active=True).select_related("role").first()
            if not user:
                raise serializers.ValidationError("Active assignee does not exist.")
            if getattr(getattr(user, "role", None), "code", None) != "EMPLOYEE":
                raise serializers.ValidationError("Assignee must have an active EMPLOYEE role.")
        return value


class ManagerTaskUpdateSerializer(serializers.Serializer):
    """Serializer validating field updates on existing task."""

    title = serializers.CharField(
        max_length=255,
        required=False,
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    priority = serializers.ChoiceField(
        choices=Task.Priority.choices,
        required=False,
    )
    deadline = serializers.DateField(required=False)
    assignee_id = serializers.IntegerField(required=False)

    def validate_title(self, value):
        """Ensure updated title is not empty string."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Task title cannot be empty.")
        return value

    def validate_assignee_id(self, value):
        """Ensure reassigned user is an active employee."""
        if value is not None:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.filter(id=value, is_active=True).select_related("role").first()
            if not user:
                raise serializers.ValidationError("Active assignee does not exist.")
            if getattr(getattr(user, "role", None), "code", None) != "EMPLOYEE":
                raise serializers.ValidationError("Assignee must have an active EMPLOYEE role.")
        return value

    def validate(self, attrs):
        """Ensure at least one modifiable field is provided in payload."""
        if not attrs:
            raise serializers.ValidationError(
                "At least one field must be provided."
            )
        return attrs


class ManagerTaskStatusSerializer(serializers.Serializer):
    """Serializer validating explicit status change requests."""

    to_status = serializers.ChoiceField(
        choices=Task.Status.choices,
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )


class ManagerKanbanMoveSerializer(serializers.Serializer):
    """Serializer validating Kanban column transition and adjacent task positions."""

    to_status = serializers.ChoiceField(
        choices=Task.Status.choices,
        required=False,
        allow_null=True,
    )
    prev_task_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )
    next_task_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )

    def validate(self, attrs):
        """Ensure preceding and following sibling task IDs are not identical."""
        prev_task_id = attrs.get("prev_task_id")
        next_task_id = attrs.get("next_task_id")

        if (
            prev_task_id is not None
            and next_task_id is not None
            and prev_task_id == next_task_id
        ):
            raise serializers.ValidationError(
                {
                    "next_task_id": "prev_task_id and next_task_id must be different."
                }
            )

        return attrs


class ManagerTaskCommentSerializer(serializers.ModelSerializer):
    """Serializer managing creation and retrieval of task discussion comments."""

    user = ManagerUserMiniSerializer(read_only=True)

    class Meta:
        model = TaskComment
        fields = [
            "id",
            "task",
            "user",
            "content",
            "comment_type",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "task",
            "user",
            "comment_type",
            "created_at",
        ]

    def validate_content(self, value):
        """Validate non-empty comment body text."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Comment content is required.")
        return value


class ManagerTaskAttachmentSerializer(serializers.ModelSerializer):
    """Serializer managing task file attachment records and metadata."""

    user = ManagerUserMiniSerializer(read_only=True)

    class Meta:
        model = TaskAttachment
        fields = [
            "id",
            "task",
            "user",
            "file_name",
            "file_url",
            "file_size",
            "uploaded_at",
        ]
        read_only_fields = [
            "id",
            "task",
            "user",
            "uploaded_at",
        ]

    def validate_file_name(self, value):
        """Validate non-empty file name string."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("file_name is required.")
        return value

    def validate_file_url(self, value):
        """Validate non-empty file URL string."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("file_url is required.")
        return value


class TaskSerializer(serializers.ModelSerializer):
    """Compatibility serializer for legacy task operations."""

    class Meta:
        model = Task
        fields = [
            "id",
            "job",
            "assignee",
            "creator",
            "title",
            "description",
            "priority",
            "status",
            "deadline",
            "completed_at",
            "order_index",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "creator",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        """Fallback creation setting default order index if omitted."""
        if not validated_data.get("order_index"):
            validated_data["order_index"] = "U"
        return super().create(validated_data)


class RejectTaskSerializer(serializers.Serializer):
    """Serializer validating mandatory rejection explanation text."""

    rejection_reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_rejection_reason(self, value):
        """Ensure rejection reason contains non-whitespace text."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Rejection reason is required."
            )
        return value