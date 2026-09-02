from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from projects.models import Job
from tasks.models import Task, TaskComment, TaskAttachment
from tasks.services.task_deadline_calculator_service import calculate_task_deadline_health


class ManagerUserMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    role = serializers.CharField(source="role.code", read_only=True)
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
        return (
            obj.deadline < timezone.localdate()
            and obj.status not in [
                Task.Status.COMPLETED,
                Task.Status.CANCELLED,
            ]
        )

    def get_deadline_health(self, obj):
        return calculate_task_deadline_health(obj)

    def get_comment_count(self, obj):
        if hasattr(obj, "comment_count"):
            return obj.comment_count

        return obj.comments.count()

    def get_attachment_count(self, obj):
        if hasattr(obj, "attachment_count"):
            return obj.attachment_count

        return obj.attachments.count()

    def get_rejection_count(self, obj):
        return obj.comments.filter(
            Q(comment_type=TaskComment.CommentType.REJECTION_NOTE)
            | Q(content__startswith="[Rejection Note]")
            | Q(content__startswith="[Rework Requested]")
        ).count()

    def get_latest_rejection(self, obj):
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
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Task title is required.")

        return value

    def validate_deadline(self, value):
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError(
                f"Task deadline cannot be in the past (must be on or after {today})."
            )
        return value

    def validate_assignee_id(self, value):
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
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Task title cannot be empty.")

        return value

    def validate_assignee_id(self, value):
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
        if not attrs:
            raise serializers.ValidationError(
                "At least one field must be provided."
            )

        return attrs


class ManagerTaskStatusSerializer(serializers.Serializer):
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
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Comment content is required.")

        return value


class ManagerTaskAttachmentSerializer(serializers.ModelSerializer):
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
        value = value.strip()

        if not value:
            raise serializers.ValidationError("file_name is required.")

        return value


    def validate_file_url(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("file_url is required.")

        return value


# ============================================================
# Compatibility serializers
# Giữ lại để tasks/views_manager.py cũ không bị vỡ import.
# Sau khi refactor views_manager.py xong, có thể bỏ dần nếu không dùng.
# ============================================================

class TaskSerializer(serializers.ModelSerializer):
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
        """
        Compatibility create cho view cũ.

        Lưu ý:
        - Logic chuẩn sẽ chuyển sang task_manager_service.create_task().
        - Hàm này chỉ giúp serializer cũ không bị lỗi khi chưa refactor view.
        """
        if not validated_data.get("order_index"):
            validated_data["order_index"] = "U"

        return super().create(validated_data)


class RejectTaskSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_rejection_reason(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Rejection reason is required."
            )

        return value