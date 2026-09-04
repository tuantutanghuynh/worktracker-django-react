"""
Module: projects.manager.serializers_manager
Description: Manager serializers for job lists, detail views, creation, updates, and status transitions.
"""

from django.utils import timezone
from rest_framework import serializers

from projects.models import Client, Job
from projects.services.job_health_calculator_service import calculate_job_health
from tasks.models import Task


class ManagerClientMiniSerializer(serializers.ModelSerializer):
    """Compact client serializer providing core identity and contact details."""

    class Meta:
        model = Client
        fields = [
            "id",
            "client_name",
            "tax_code",
            "contact_person",
            "contact_email",
            "contact_phone",
            "address",
            "industry",
            "notes",
            "is_active",
        ]


class ManagerUserMiniSerializer(serializers.Serializer):
    """Compact user serializer providing basic profile name and avatar data."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        """Return full name from profile or fallback to email address."""
        profile = getattr(obj, "profile", None)
        if profile and profile.full_name:
            return profile.full_name
        return obj.email

    def get_avatar_url(self, obj):
        """Return avatar URL from user profile if available."""
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "avatar_url", None):
            return profile.avatar_url
        return None


class ManagerJobListSerializer(serializers.ModelSerializer):
    """Serializer representing project job list item with health and workload progress."""

    client = ManagerClientMiniSerializer(read_only=True)
    manager = ManagerUserMiniSerializer(read_only=True)
    task_counts = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    health = serializers.SerializerMethodField()
    team_size = serializers.SerializerMethodField()
    project_team = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id",
            "job_code",
            "job_name",
            "description",
            "client",
            "manager",
            "priority",
            "status",
            "start_date",
            "deadline",
            "team_size",
            "project_team",
            "task_counts",
            "is_overdue",
            "health",
            "created_at",
            "updated_at",
        ]

    def get_team_size(self, obj):
        """Calculate total count of unique team assignees and chat participants excluding manager."""
        from chat.models import ChatParticipant
        task_assignee_ids = set(obj.tasks.values_list("assignee_id", flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job=obj, room__room_type='JOB')
            .exclude(user=obj.manager)
            .values_list('user_id', flat=True)
            .distinct()
        )
        return len((task_assignee_ids | team_participant_ids) - {obj.manager_id, None})

    def get_project_team(self, obj):
        """Return list of project team members with active task counts."""
        from accounts.models import CustomUser
        from chat.models import ChatParticipant
        from django.db.models import Count, Q

        task_assignee_ids = set(obj.tasks.values_list("assignee_id", flat=True).distinct())
        team_participant_ids = set(
            ChatParticipant.objects.filter(room__job=obj, room__room_type='JOB')
            .exclude(user=obj.manager)
            .values_list('user_id', flat=True)
            .distinct()
        )
        all_member_ids = (task_assignee_ids | team_participant_ids) - {obj.manager_id}
        users = CustomUser.objects.filter(id__in=all_member_ids, is_active=True).select_related("profile", "profile__department")

        active_counts_query = (
            obj.tasks.filter(
                status__in=[Task.Status.TODO, Task.Status.IN_PROGRESS, Task.Status.REVIEWING]
            )
            .values("assignee_id")
            .annotate(cnt=Count("id"))
        )
        active_map = {row["assignee_id"]: row["cnt"] for row in active_counts_query}

        return [
            {
                "id": u.id,
                "email": u.email,
                "full_name": getattr(getattr(u, "profile", None), "full_name", "") or u.email,
                "avatar_url": getattr(getattr(u, "profile", None), "avatar_url", None),
                "department_name": getattr(getattr(getattr(u, "profile", None), "department", None), "name", "No Department"),
                "active_tasks_count": active_map.get(u.id, 0),
            }
            for u in users
        ]

    def get_task_counts(self, obj):
        """Retrieve aggregated task status counts for the job."""
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
        """Determine whether job deadline has passed for incomplete jobs."""
        return obj.deadline < timezone.localdate() and obj.status not in [
            Job.Status.COMPLETED,
            Job.Status.CANCELLED,
        ]

    def get_health(self, obj):
        """Calculate dynamic health indicator dictionary for job."""
        task_counts = self.get_task_counts(obj)
        return calculate_job_health(obj, task_counts=task_counts)


class ManagerJobDetailSerializer(ManagerJobListSerializer):
    """Detailed serializer for single job retrieval in manager views."""

    manager = ManagerUserMiniSerializer(read_only=True)

    class Meta(ManagerJobListSerializer.Meta):
        fields = ManagerJobListSerializer.Meta.fields + [
            "description",
            "manager",
            "created_at",
            "updated_at",
        ]


class ManagerJobCreateSerializer(serializers.ModelSerializer):
    """Serializer validating new job creation parameters submitted by managers."""

    client_id = serializers.PrimaryKeyRelatedField(
        source="client",
        queryset=Client.objects.filter(is_active=True),
        write_only=True,
    )
    initial_team_member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Job
        fields = [
            "client_id",
            "job_code",
            "job_name",
            "priority",
            "description",
            "start_date",
            "deadline",
            "initial_team_member_ids",
        ]

    def validate(self, attrs):
        """Validate manager scoping, past deadline restrictions, and date sequence."""
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
        today = timezone.localdate()

        if deadline and deadline < today:
            raise serializers.ValidationError(
                {"deadline": f"Job deadline cannot be in the past (must be on or after {today})."}
            )

        if start_date and deadline and deadline < start_date:
            raise serializers.ValidationError(
                {"deadline": "Job deadline must not be earlier than start date."}
            )

        initial_team_ids = attrs.get("initial_team_member_ids")
        if initial_team_ids:
            request = self.context.get("request")
            manager_user = getattr(request, "user", None)
            if manager_user:
                from accounts.models import CustomUser
                invalid_emps = list(
                    CustomUser.objects.filter(id__in=initial_team_ids)
                    .exclude(
                        role__code="EMPLOYEE",
                        is_active=True,
                        profile__manager=manager_user,
                    )
                    .values_list("id", flat=True)
                )
                if invalid_emps:
                    raise serializers.ValidationError(
                        {
                            "initial_team_member_ids": (
                                f"Employees with IDs {invalid_emps} are not assigned under your direct management."
                            )
                        }
                    )

        return attrs


class ManagerJobUpdateSerializer(serializers.ModelSerializer):
    """Serializer validating job edits and team member modifications by managers."""

    team_member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Job
        fields = [
            "job_name",
            "priority",
            "description",
            "deadline",
            "team_member_ids",
        ]

    def validate(self, attrs):
        """Validate update constraints, deadline adjustments, and active child task guards."""
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
        if job and job.client and not job.client.is_active:
            raise serializers.ValidationError(
                f"Cannot update project '{job.job_name}' because client '{job.client.client_name}' is deactivated by Admin. "
                "The project is frozen and editing is locked."
            )

        new_deadline = attrs.get("deadline")

        if job and new_deadline:
            if new_deadline < job.start_date:
                raise serializers.ValidationError(
                    {"deadline": "Job deadline must not be earlier than start date."}
                )

            if job.deadline and new_deadline < job.deadline:
                max_task = (
                    job.tasks.exclude(status=Task.Status.CANCELLED)
                    .order_by("-deadline")
                    .first()
                )
                
                if max_task and max_task.deadline and max_task.deadline > new_deadline:
                    raise serializers.ValidationError(
                        {
                            "deadline": (
                                f"Cannot shorten job deadline to {new_deadline} because child task "
                                f"'{max_task.title}' has a deadline of {max_task.deadline}. "
                                "Please adjust child task deadlines first."
                            )
                        }
                    )

        team_member_ids = attrs.get("team_member_ids")
        if team_member_ids is not None:
            request = self.context.get("request")
            manager_user = getattr(request, "user", None)
            if manager_user:
                from accounts.models import CustomUser
                invalid_emps = list(
                    CustomUser.objects.filter(id__in=team_member_ids)
                    .exclude(
                        role__code="EMPLOYEE",
                        is_active=True,
                        profile__manager=manager_user,
                    )
                    .values_list("id", flat=True)
                )
                if invalid_emps:
                    raise serializers.ValidationError(
                        {
                            "team_member_ids": (
                                f"Employees with IDs {invalid_emps} are not assigned under your direct management."
                            )
                        }
                    )

            if job:
                from chat.models import ChatParticipant
                from accounts.models import CustomUser

                current_job_emp_ids = (
                    set(
                        ChatParticipant.objects.filter(room__job=job, room__room_type='JOB')
                        .exclude(user=job.manager)
                        .values_list('user_id', flat=True)
                    )
                    | set(job.tasks.values_list('assignee_id', flat=True))
                ) - {job.manager_id}

                removed_emp_ids = current_job_emp_ids - set(team_member_ids)
                if removed_emp_ids:
                    for rem_id in removed_emp_ids:
                        active_tasks = job.tasks.filter(
                            assignee_id=rem_id,
                            status__in=[Task.Status.TODO, Task.Status.IN_PROGRESS, Task.Status.REVIEWING]
                        )
                        if active_tasks.exists():
                            emp_obj = CustomUser.objects.filter(id=rem_id).first()
                            emp_name = (
                                getattr(getattr(emp_obj, "profile", None), "full_name", "")
                                or getattr(emp_obj, "email", f"ID {rem_id}")
                            )
                            task_titles = list(active_tasks.values_list("title", flat=True)[:3])
                            task_list_str = ", ".join(f"'{t}'" for t in task_titles)
                            if active_tasks.count() > 3:
                                task_list_str += f" and {active_tasks.count() - 3} more"

                            raise serializers.ValidationError(
                                {
                                    "team_member_ids": (
                                        f"Cannot remove '{emp_name}' from the project because they still have "
                                        f"{active_tasks.count()} active task(s) ({task_list_str}). "
                                        "Please reassign or cancel their tasks before removing them."
                                    )
                                }
                            )

        return attrs


class ManagerJobStatusChangeSerializer(serializers.Serializer):
    """Serializer validating requested job status transition and required reason text."""

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
        """Ensure reason text is supplied for cancellation or on-hold status changes."""
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
