from rest_framework import serializers

from projects.models import Job
from tasks.models import Task


class EmployeeMyTeamJobSerializer(serializers.ModelSerializer):
    """1 dự án mà Employee đang tham gia, kèm Manager + đồng nghiệp
    cùng dự án. `teammates_by_job` (dict job_id -> list) được truyền
    qua context để tránh N+1 (đã tính bulk 1 lần ở view)."""
    client_name = serializers.CharField(source="client.client_name", read_only=True)
    manager = serializers.SerializerMethodField()
    teammates = serializers.SerializerMethodField()
    task_progress = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "job_code", "job_name", "status", "priority",
            "deadline", "updated_at", "client_name", "manager", "teammates",
            "task_progress",
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

    def get_task_progress(self, obj):
        """Tiến độ TOÀN BỘ dự án — tổng hợp mọi task trong job (không chỉ
        task của người gọi API). Công thức khớp ManagerJobDetailPage:
        pct = completed / total, total tính cả CANCELLED."""
        stats = self.context.get("task_stats_by_job", {}).get(obj.id, {})
        total = sum(stats.values())
        completed = stats.get(Task.Status.COMPLETED, 0)
        return {
            "total": total,
            "completed": completed,
            "in_progress": stats.get(Task.Status.IN_PROGRESS, 0),
            "reviewing": stats.get(Task.Status.REVIEWING, 0),
            "todo": stats.get(Task.Status.TODO, 0),
            "cancelled": stats.get(Task.Status.CANCELLED, 0),
            "pct": round((completed / total) * 100) if total else 0,
        }
