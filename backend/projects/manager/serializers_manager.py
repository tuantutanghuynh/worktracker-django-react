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
            "tax_code",  # ➕ BỔ SUNG: Mã số thuế
            "contact_person",  # ➕ BỔ SUNG: Người liên hệ
            "contact_email",  # ➕ BỔ SUNG: Email liên hệ
            "contact_phone",  # ➕ BỔ SUNG: SĐT liên hệ
            "address",  # ➕ BỔ SUNG: Địa chỉ trụ sở
            "industry",  # Lĩnh vực hoạt động
            "notes",  # ➕ BỔ SUNG: Ghi chú nội bộ
            "is_active",  # ➕ BỔ SUNG: Trạng thái hoạt động
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
            "job_code",  # ➕ BỔ SUNG: Mã dự án (VD: ERP-2024-068)
            "job_name",
            "client",
            "priority",  # ➕ BỔ SUNG: Mức độ ưu tiên (HIGH, MEDIUM, LOW)
            "status",
            "start_date",
            "deadline",
            "task_counts",
            "is_overdue",
        ]

    def get_task_counts(self, obj):
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

            # 2. FALLBACK TỐI ƯU: Đếm tất cả trạng thái trong CHỈ 1 CÂU QUERY SQL duy nhất
        from django.db.models import Count, Q

        counts = obj.tasks.aggregate(
            total_tasks=Count("id"),
            todo_count=Count("id", filter=Q(status=Task.Status.TODO)),
            in_progress_count=Count("id", filter=Q(status=Task.Status.IN_PROGRESS)),
            reviewing_count=Count("id", filter=Q(status=Task.Status.REVIEWING)),
            completed_count=Count("id", filter=Q(status=Task.Status.COMPLETED)),
            cancelled_count=Count("id", filter=Q(status=Task.Status.CANCELLED)),
        )
        return counts

    def get_is_overdue(self, obj):
        return obj.deadline < timezone.localdate() and obj.status not in [
            Job.Status.COMPLETED,
            Job.Status.CANCELLED,
        ]


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
            "job_code",  # ➕ BỔ SUNG: Cho phép truyền mã dự án
            "job_name",
            "priority",  # ➕ BỔ SUNG: Cho phép chọn độ ưu tiên (Mặc định MEDIUM)
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

        invalid_fields = forbidden_fields.intersection(set(self.initial_data.keys()))

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
                {"deadline": "Job deadline must not be earlier than start date."}
            )

        return attrs


class ManagerJobUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = [
            "job_name",
            "priority",  # ➕ BỔ SUNG: Cho phép sửa độ ưu tiên khi Edit Job
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

        invalid_fields = forbidden_fields.intersection(set(self.initial_data.keys()))

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
                {"deadline": "Job deadline must not be earlier than start date."}
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

        if (
            new_status
            in [
                Job.Status.CANCELLED,
                Job.Status.ON_HOLD,
            ]
            and not reason
        ):
            raise serializers.ValidationError(
                {"reason": "Reason is required for this status."}
            )

        return attrs
