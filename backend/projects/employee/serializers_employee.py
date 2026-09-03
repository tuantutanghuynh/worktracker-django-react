"""
Module: projects.employee.serializers_employee
Description: Employee serializers for project job overviews, team rosters, and task completion progress.
"""

from rest_framework import serializers

from projects.models import Job
from tasks.models import Task


class EmployeeMyTeamJobSerializer(serializers.ModelSerializer):
    """Serializer representing employee job involvement with manager profile, teammates, and task statistics."""

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
        """Return profile overview dictionary for the assigned project manager."""
        manager = obj.manager
        profile = getattr(manager, "profile", None)
        return {
            "id": manager.id,
            "full_name": profile.full_name if profile else None,
            "email": manager.email,
            "avatar_url": profile.avatar_url if profile else None,
        }

    def get_teammates(self, obj):
        """Return cached list of team members engaged on the project."""
        teammates_by_job = self.context.get("teammates_by_job", {})
        return teammates_by_job.get(obj.id, [])

    def get_task_progress(self, obj):
        """Calculate overall project task counts and completion percentage."""
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
