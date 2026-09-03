"""
Module: projects.manager.views_manager
Description: Manager viewsets for scoped project job administration and client catalog lookups.
"""

from django.db import transaction
from django.db.models import Count, Q

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from projects.models import Job, Client
from projects.manager.serializers_manager import (
    ManagerClientMiniSerializer,
    ManagerJobCreateSerializer,
    ManagerJobDetailSerializer,
    ManagerJobListSerializer,
    ManagerJobStatusChangeSerializer,
    ManagerJobUpdateSerializer,
)
from projects.manager.filters_manager import ManagerJobFilter
from projects.services.job_status_manager_service import manager_change_job_status

from tasks.models import Task

from system.security.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
from system.security.scoping_manager import scoped_jobs
from system.services.audit_manager_service import snapshot, log_action


class ManagerJobViewSet(viewsets.ModelViewSet):
    """ViewSet managing manager-scoped project job retrieval, creation, updates, and state transitions."""

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]

    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]
    
    def get_permissions(self):
        """Map specific actions to required permission codes."""
        action_permissions = {
            "list": "job:view",
            "retrieve": "job:view",
            "create": "job:create",
            "partial_update": "job:update",
            "change_status": "job:change_status",
        }
        
        self.required_permission = action_permissions.get(self.action)
        return super().get_permissions()

    def get_queryset(self):
        """Retrieve scoped job queryset annotated with task status aggregates for the manager."""
        return (
            scoped_jobs(self.request.user)
            .select_related("client", "manager", "manager__profile")
            .annotate(
                total_tasks=Count("tasks", distinct=True),
                todo_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.TODO),
                    distinct=True,
                ),
                in_progress_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.IN_PROGRESS),
                    distinct=True,
                ),
                reviewing_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.REVIEWING),
                    distinct=True,
                ),
                completed_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.COMPLETED),
                    distinct=True,
                ),
                cancelled_count=Count(
                    "tasks",
                    filter=Q(tasks__status=Task.Status.CANCELLED),
                    distinct=True,
                ),
            )
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        """Return dedicated serializer based on request action."""
        if self.action == "list":
            return ManagerJobListSerializer

        if self.action == "create":
            return ManagerJobCreateSerializer

        if self.action in ["partial_update"]:
            return ManagerJobUpdateSerializer

        if self.action == "change_status":
            return ManagerJobStatusChangeSerializer

        return ManagerJobDetailSerializer

    def list(self, request, *args, **kwargs):
        """List paginated and filtered project jobs for authenticated manager."""
        queryset = self.get_queryset()
        queryset = ManagerJobFilter.apply(queryset, request.query_params)

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ManagerJobListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ManagerJobListSerializer(queryset, many=True)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        """Retrieve detailed job record by primary key."""
        job = self.get_object()
        serializer = ManagerJobDetailSerializer(job)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        """Create new job instance, bind manager ownership, and initialize project chat room."""
        serializer = ManagerJobCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            initial_team_ids = serializer.validated_data.pop("initial_team_member_ids", None)
            job = serializer.save(
                manager=request.user,
            )

            from chat.models import ChatRoom, ChatParticipant
            room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
            room, _ = ChatRoom.objects.get_or_create(
                room_type=ChatRoom.RoomType.JOB,
                job=job,
                defaults={"name": room_name},
            )
            ChatParticipant.objects.get_or_create(room=room, user=request.user)

            if initial_team_ids:
                from accounts.models import CustomUser
                employees = CustomUser.objects.filter(
                    id__in=initial_team_ids,
                    role__code="EMPLOYEE",
                    is_active=True,
                    profile__manager=request.user,
                )
                for emp in employees:
                    _, created = ChatParticipant.objects.get_or_create(room=room, user=emp)
                    if created:
                        try:
                            from tasks.services.task_email_service import send_project_team_added_email
                            send_project_team_added_email(job, emp, request=request)
                        except Exception:
                            pass

            log_action(
                user=request.user,
                action="CREATE_JOB",
                table_name="jobs",
                record_id=job.id,
                old_values=None,
                new_values=snapshot(job),
                request=request,
            )

        output_serializer = ManagerJobDetailSerializer(job)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        """Update job details, adjust team members, and record audit log."""
        job = self.get_object()

        old_values = snapshot(
            job,
            fields=[
                "job_name",
                "priority",
                "description",
                "deadline",
            ],
        )

        serializer = ManagerJobUpdateSerializer(
            instance=job,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            team_member_ids = serializer.validated_data.pop("team_member_ids", None)
            updated_job = serializer.save()

            if team_member_ids is not None:
                from chat.models import ChatRoom, ChatParticipant
                from accounts.models import CustomUser

                room_name = f"#{updated_job.job_code or f'JOB-{updated_job.id}'}: {updated_job.job_name}"
                room, _ = ChatRoom.objects.get_or_create(
                    room_type=ChatRoom.RoomType.JOB,
                    job=updated_job,
                    defaults={"name": room_name},
                )
                ChatParticipant.objects.get_or_create(room=room, user=request.user)

                current_participants = ChatParticipant.objects.filter(
                    room=room
                ).exclude(user=request.user)

                target_emps = CustomUser.objects.filter(
                    id__in=team_member_ids,
                    role__code="EMPLOYEE",
                    is_active=True,
                    profile__manager=request.user,
                )
                target_emp_ids = set(target_emps.values_list("id", flat=True))

                current_participants.exclude(user_id__in=target_emp_ids).delete()

                for emp in target_emps:
                    _, created = ChatParticipant.objects.get_or_create(room=room, user=emp)
                    if created:
                        try:
                            from tasks.services.task_email_service import send_project_team_added_email
                            send_project_team_added_email(updated_job, emp, request=request)
                        except Exception:
                            pass

            log_action(
                user=request.user,
                action="UPDATE_JOB",
                table_name="jobs",
                record_id=updated_job.id,
                old_values=old_values,
                new_values=snapshot(
                    updated_job,
                    fields=[
                        "job_name",
                        "priority",
                        "description",
                        "deadline",
                    ],
                ),
                request=request,
            )

        output_serializer = ManagerJobDetailSerializer(updated_job)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        """Execute state transition for job status via status manager service."""
        job = self.get_object()

        serializer = ManagerJobStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_job = manager_change_job_status(
            user=request.user,
            job=job,
            new_status=serializer.validated_data["new_status"],
            reason=serializer.validated_data.get("reason"),
            request=request,
        )

        output_serializer = ManagerJobDetailSerializer(updated_job)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )


class ManagerClientViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset listing active clients for manager assignment dropdowns."""

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    serializer_class = ManagerClientMiniSerializer
    queryset = Client.objects.filter(is_active=True).order_by("client_name")

    def get_permissions(self):
        """Assign client view permission for manager queries."""
        self.required_permission = "client:view"
        return super().get_permissions()