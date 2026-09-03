"""
Module: projects.employee.views_employee
Description: Employee view providing project memberships, assigned managers, and fellow teammates.
"""

from collections import defaultdict

from django.db.models import Count
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Job
from tasks.models import Task
from system.security.permissions_manager import IsActiveAuthenticated, HasPermissionCode
from system.security.scoping_manager import employee_job_ids
from projects.employee.serializers_employee import EmployeeMyTeamJobSerializer


class EmployeeMyTeamView(APIView):
    """View providing employee-scoped project overviews, designated managers, and fellow team members."""

    permission_classes = [IsActiveAuthenticated, HasPermissionCode]
    required_permission = "job:view"

    def get(self, request):
        """Retrieve list of active projects with teammates and project-wide task statistics."""
        job_ids = list(employee_job_ids(request.user))

        jobs = (
            Job.objects.filter(id__in=job_ids)
            .select_related("manager", "manager__profile", "client")
            .order_by("-start_date")
        )

        rows = (
            Task.objects.filter(job_id__in=job_ids)
            .exclude(assignee__isnull=True)
            .values(
                "job_id", "assignee_id", "assignee__email",
                "assignee__is_active",
                "assignee__profile__full_name",
                "assignee__profile__avatar_url",
            )
            .distinct()
        )

        teammates_by_job = defaultdict(list)
        for row in rows:
            teammates_by_job[row["job_id"]].append({
                "id": row["assignee_id"],
                "full_name": row["assignee__profile__full_name"],
                "email": row["assignee__email"],
                "avatar_url": row["assignee__profile__avatar_url"],
                "is_active": row["assignee__is_active"],
                "is_me": row["assignee_id"] == request.user.id,
            })

        status_rows = (
            Task.objects.filter(job_id__in=job_ids)
            .values("job_id", "status")
            .annotate(count=Count("id"))
        )
        task_stats_by_job = defaultdict(lambda: defaultdict(int))
        for row in status_rows:
            task_stats_by_job[row["job_id"]][row["status"]] = row["count"]

        serializer = EmployeeMyTeamJobSerializer(
            jobs, many=True,
            context={
                "teammates_by_job": teammates_by_job,
                "task_stats_by_job": task_stats_by_job,
            },
        )
        return Response(serializer.data)
