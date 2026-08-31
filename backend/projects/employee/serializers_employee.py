from rest_framework import serializers

from projects.models import Job


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
