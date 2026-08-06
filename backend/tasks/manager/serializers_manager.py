from django.utils import timezone
from rest_framework import serializers

from projects.models import Job
from tasks.models import Task, TaskComment, TaskAttachment


class ManagerUserMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)

        if profile and profile.full_name:
            return profile.full_name

        return obj.email


class ManagerJobMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = [
            "id",
            "job_name",
            "status",
            "deadline",
        ]


class ManagerTaskListSerializer(serializers.ModelSerializer):
    assignee = ManagerUserMiniSerializer(read_only=True)
    is_overdue = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "priority",
            "status",
            "deadline",
            "assignee",
            "order_index",
            "is_overdue",
            "comment_count",
            "attachment_count",
        ]

    def get_is_overdue(self, obj):
        return (
            obj.deadline < timezone.localdate()
            and obj.status not in [
                Task.Status.COMPLETED,
                Task.Status.CANCELLED,
            ]
        )

    def get_comment_count(self, obj):
        if hasattr(obj, "comment_count"):
            return obj.comment_count

        return obj.comments.count()

    def get_attachment_count(self, obj):
        if hasattr(obj, "attachment_count"):
            return obj.attachment_count

        return obj.attachments.count()


class ManagerTaskDetailSerializer(ManagerTaskListSerializer):
    job = ManagerJobMiniSerializer(read_only=True)
    creator = ManagerUserMiniSerializer(read_only=True)

    class Meta(ManagerTaskListSerializer.Meta):
        fields = ManagerTaskListSerializer.Meta.fields + [
            "description",
            "job",
            "creator",
            "completed_at",
            "created_at",
            "updated_at",
        ]


class ManagerTaskCreateSerializer(serializers.Serializer):
    job_id = serializers.IntegerField()
    assignee_id = serializers.IntegerField()
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