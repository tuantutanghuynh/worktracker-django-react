from rest_framework import serializers

from projects.models import Job


class EmployeeMyTeamUserMiniSerializer(serializers.Serializer):
    """Thông tin tối thiểu của 1 người (Manager hoặc đồng nghiệp) —
    chỉ danh tính/liên hệ, KHÔNG có số liệu workload."""
    id = serializers.IntegerField()
    full_name = serializers.CharField(allow_null=True)
    email = serializers.EmailField()
    avatar_url = serializers.CharField(allow_null=True, required=False)


class EmployeeMyTeamTeammateSerializer(EmployeeMyTeamUserMiniSerializer):
    is_active = serializers.BooleanField()
    is_me = serializers.BooleanField()


class EmployeeMyTeamJobSerializer(serializers.ModelSerializer):
    """1 dự án mà Employee đang tham gia, kèm Manager + đồng nghiệp
    cùng dự án. `teammates_by_job` (dict job_id -> list) được truyền
    qua context để tránh N+1 (đã tính bulk 1 lần ở view)."""
    client_name = serializers.CharField(source="client.client_name", read_only=True)
    manager = serializers.SerializerMethodField()
    teammates = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "job_code", "job_name", "status", "priority",
            "deadline", "client_name", "manager", "teammates",
        ]

    def get_manager(self, obj):
        manager = obj.manager
        profile = getattr(manager, "profile", None)
        return {
            "id": manager.id,
            "full_name": profile.full_name if profile else None,
            "email": manager.email,
            "avatar_url": profile.avatar_url if profile else None,
        }

    def get_teammates(self, obj):
        teammates_by_job = self.context.get("teammates_by_job", {})
        return teammates_by_job.get(obj.id, [])
