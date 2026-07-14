from django.utils import timezone
from rest_framework import serializers

from projects.models import Client, Job
from tasks.models import Task


class ManagerClientMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "client_name",
        ]


class ManagerUserMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)

        if profile and profile.full_name:
            return profile.full_name

        return obj.email


class ManagerJobListSerializer(serializers.ModelSerializer):
    client = ManagerClientMiniSerializer(read_only=True)
    task_counts = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id",
            "job_name",
            "client",
            "status",
            "start_date",
            "deadline",
            "task_counts",
            "is_overdue",
        ]

    def get_task_counts(self, obj):
        """
        Ưu tiên dùng dữ liệu annotate từ queryset.
        Nếu view chưa annotate, fallback sang query theo related_name='tasks'.
        """
        annotated_fields = [
            "total_tasks",
            "todo_count",
            "in_progress_count",
            "reviewing_count",
            "completed_count",
            "cancelled_count",
        ]

        if all(hasattr(obj, field) for field in annotated_fields):
            return {
                "total_tasks": obj.total_tasks,
                "todo_count": obj.todo_count,
                "in_progress_count": obj.in_progress_count,
                "reviewing_count": obj.reviewing_count,
                "completed_count": obj.completed_count,
                "cancelled_count": obj.cancelled_count,
            }

        tasks = obj.tasks.all()

        return {
            "total_tasks": tasks.count(),
            "todo_count": tasks.filter(status=Task.Status.TODO).count(),
            "in_progress_count": tasks.filter(status=Task.Status.IN_PROGRESS).count(),
            "reviewing_count": tasks.filter(status=Task.Status.REVIEWING).count(),
            "completed_count": tasks.filter(status=Task.Status.COMPLETED).count(),
            "cancelled_count": tasks.filter(status=Task.Status.CANCELLED).count(),
        }

    def get_is_overdue(self, obj):
        return (
            obj.deadline < timezone.localdate()
            and obj.status not in [
                Job.Status.COMPLETED,
                Job.Status.CANCELLED,
            ]
        )


class ManagerJobDetailSerializer(ManagerJobListSerializer):
    manager = ManagerUserMiniSerializer(read_only=True)

    class Meta(ManagerJobListSerializer.Meta):
        fields = ManagerJobListSerializer.Meta.fields + [
            "description",
            "manager",
            "created_at",
            "updated_at",
        ]


class ManagerJobCreateSerializer(serializers.ModelSerializer):
    client_id = serializers.PrimaryKeyRelatedField(
        source="client",
        queryset=Client.objects.filter(is_active=True),
        write_only=True,
    )

    class Meta:
        model = Job
        fields = [
            "client_id",
            "job_name",
            "description",
            "start_date",
            "deadline",
        ]

    def validate(self, attrs):
        forbidden_fields = {
            "manager",
            "manager_id",
            "status",
        }

        invalid_fields = forbidden_fields.intersection(
            set(self.initial_data.keys())
        )

        if invalid_fields:
            raise serializers.ValidationError(
                {
                    "forbidden_fields": sorted(invalid_fields),
                    "message": "Manager is not allowed to submit these fields.",
                }
            )

        start_date = attrs.get("start_date")
        deadline = attrs.get("deadline")

        if start_date and deadline and deadline < start_date:
            raise serializers.ValidationError(
                {
                    "deadline": "Job deadline must not be earlier than start date."
                }
            )

        return attrs


class ManagerJobUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = [
            "job_name",
            "description",
            "deadline",
        ]

    def validate(self, attrs):
        forbidden_fields = {
            "manager",
            "manager_id",
            "client",
            "client_id",
            "status",
        }

        invalid_fields = forbidden_fields.intersection(
            set(self.initial_data.keys())
        )

        if invalid_fields:
            raise serializers.ValidationError(
                {
                    "forbidden_fields": sorted(invalid_fields),
                    "message": "Manager is not allowed to update these fields here.",
                }
            )

        job = self.instance
        new_deadline = attrs.get("deadline")

        if job and new_deadline and new_deadline < job.start_date:
            raise serializers.ValidationError(
                {
                    "deadline": "Job deadline must not be earlier than start date."
                }
            )

        return attrs


class ManagerJobStatusChangeSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(
        choices=Job.Status.choices,
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )

    def validate(self, attrs):
        new_status = attrs.get("new_status")
        reason = attrs.get("reason")

        if new_status in [
            Job.Status.CANCELLED,
            Job.Status.ON_HOLD,
        ] and not reason:
            raise serializers.ValidationError(
                {
                    "reason": "Reason is required for this status."
                }
            )

        return attrs