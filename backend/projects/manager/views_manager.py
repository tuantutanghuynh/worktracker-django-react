from django.db import transaction
from django.db.models import Count, Q

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from projects.models import Job
from projects.manager.serializers_manager import (
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
    """
    Manager Job API.

    Scope chính thức:
        jobs.manager_id = request.user.id

    Không dùng departments.manager_id để tính scope.
    """

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
        """
        Khai báo required_permission động dựa trên action hiện tại.
        HasPermissionCode sẽ tự động lấy giá trị này để kiểm duyệt.
        """
        action_permissions = {
            "list": "job:view",
            "retrieve": "job:view",
            "create": "job:create",
            "partial_update": "job:update",
            "change_status": "job:change_status",
        }
        
        # Gán quyền tương ứng vào self, nếu action không nằm trong dict trên, nó sẽ gán None (bị chặn)
        self.required_permission = action_permissions.get(self.action)
        
        return super().get_permissions()

    def get_queryset(self):
        """
        Queryset gốc luôn phải được scope trước.

        Manager chỉ thấy Job do chính Manager đó phụ trách.
        """
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
        """
        GET /api/manager/jobs/
        """
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
        """
        GET /api/manager/jobs/{id}/
        """
        job = self.get_object()
        serializer = ManagerJobDetailSerializer(job)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        """
        POST /api/manager/jobs/

        Manager tạo Job:
        - Không được truyền manager_id.
        - Hệ thống tự gán manager = request.user.
        - Status dùng default của model: PLANNING.
        """
        serializer = ManagerJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            job = serializer.save(
                manager=request.user,
            )

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
        """
        PATCH /api/manager/jobs/{id}/

        Manager chỉ được cập nhật:
        - job_name
        - description
        - deadline

        Không xử lý status ở endpoint này.
        Status dùng endpoint riêng:
            POST /api/manager/jobs/{id}/status/
        """
        job = self.get_object()

        old_values = snapshot(
            job,
            fields=[
                "job_name",
                "description",
                "deadline",
            ],
        )

        serializer = ManagerJobUpdateSerializer(
            instance=job,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            updated_job = serializer.save()

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
        """
        POST /api/manager/jobs/{id}/status/

        Đổi trạng thái Job theo state machine trong service.
        """
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