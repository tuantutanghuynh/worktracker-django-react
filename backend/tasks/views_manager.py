from django.db import transaction
from django.db.models import Count

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.models import Task, TaskComment, TaskFollower
from tasks.serializers_manager import (
    ManagerKanbanMoveSerializer,
    ManagerTaskAttachmentSerializer,
    ManagerTaskCommentSerializer,
    ManagerTaskCreateSerializer,
    ManagerTaskDetailSerializer,
    ManagerTaskListSerializer,
    ManagerTaskStatusSerializer,
    ManagerTaskUpdateSerializer,
)
from tasks.filters_manager import ManagerTaskFilter
from tasks.services.task_manager_service import (
    create_task,
    move_task_kanban,
    update_task,
)
from tasks.services.task_transition_manager_service import apply_transition

from system.models import Notification
from system.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
from system.scoping_manager import (
    get_scoped_object_or_404,
    scoped_jobs,
    scoped_tasks,
)
from system.services.audit_manager_service import log_action, snapshot
from system.services.notification_manager_service import (
    notify,
    resolve_task_recipients,
)


class TaskViewSet(viewsets.ModelViewSet):
    """
    Manager Task API.

    Scope chính thức:
        task.job.manager_id = request.user.id

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
        action_permissions = {
            "list": "task:view",
            "retrieve": "task:view",
            "create": "task:create",
            "partial_update": "task:update",
            "change_status": "task:change_status",
            "approve_task": "task:review",
            "reject_task": "task:review",
            "cancel_task": "task:cancel",
            "move_task": "task:change_status",
            "comments": "task:comment",
            "attachments": "task:attachment",
            "followers": "task:follow",
            "follow": "task:follow",
            "unfollow": "task:follow",
        }
        self.required_permission = action_permissions.get(self.action)
        return super().get_permissions()

    def get_queryset(self):
        """
        Queryset gốc luôn phải được scope trước.
        """
        return (
            scoped_tasks(self.request.user)
            .select_related(
                "job",
                "job__client",
                "assignee",
                "assignee__profile",
                "creator",
                "creator__profile",
            )
            .annotate(
                comment_count=Count("comments", distinct=True),
                attachment_count=Count("attachments", distinct=True),
            )
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ManagerTaskListSerializer

        if self.action == "create":
            return ManagerTaskCreateSerializer

        if self.action == "partial_update":
            return ManagerTaskUpdateSerializer

        if self.action in ["change_status", "cancel_task"]:
            return ManagerTaskStatusSerializer

        if self.action == "move_task":
            return ManagerKanbanMoveSerializer

        if self.action == "comments":
            return ManagerTaskCommentSerializer

        if self.action == "attachments":
            return ManagerTaskAttachmentSerializer

        return ManagerTaskDetailSerializer

    def list(self, request, *args, **kwargs):
        """
        GET /api/manager/tasks/
        """
        queryset = self.get_queryset()
        queryset = ManagerTaskFilter.apply(queryset, request.query_params)

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ManagerTaskListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ManagerTaskListSerializer(queryset, many=True)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        """
        GET /api/manager/tasks/{id}/
        """
        task = self.get_object()
        serializer = ManagerTaskDetailSerializer(task)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        """
        POST /api/manager/tasks/

        Manager tạo task dưới Job thuộc scope của mình.
        Business rule nằm trong task_manager_service.create_task().
        """
        serializer = ManagerTaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        task = create_task(
            user=request.user,
            data=serializer.validated_data,
            request=request,
        )

        output_serializer = ManagerTaskDetailSerializer(task)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        """
        PATCH /api/manager/tasks/{id}/

        Manager cập nhật:
        - title
        - description
        - priority
        - deadline
        - assignee_id
        """
        task = self.get_object()

        serializer = ManagerTaskUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_task = update_task(
            user=request.user,
            task=task,
            data=serializer.validated_data,
            request=request,
        )

        output_serializer = ManagerTaskDetailSerializer(updated_task)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        """
        Không cho xóa vật lý Task.

        Nếu không còn dùng task, dùng endpoint cancel:
            POST /api/manager/tasks/{id}/cancel/
        """
        raise MethodNotAllowed("DELETE")

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        """
        POST /api/manager/tasks/{id}/status/

        Body:
            {
                "to_status": "IN_PROGRESS",
                "reason": "optional"
            }

        Mọi transition đều đi qua state machine.
        """
        task = self.get_object()

        serializer = ManagerTaskStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=serializer.validated_data["to_status"],
            reason=serializer.validated_data.get("reason"),
            request=request,
        )

        output_serializer = ManagerTaskDetailSerializer(updated_task)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve_task(self, request, pk=None):
        """
        POST /api/manager/tasks/{id}/approve/

        Shortcut:
            REVIEWING -> COMPLETED
        """
        task = self.get_object()

        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=Task.Status.COMPLETED,
            reason=None,
            request=request,
        )

        output_serializer = ManagerTaskDetailSerializer(updated_task)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject_task(self, request, pk=None):
        """
        POST /api/manager/tasks/{id}/reject/

        Body:
            {
                "reason": "Nội dung chưa đạt yêu cầu"
            }

        Chấp nhận alias cũ:
            {
                "rejection_reason": "Nội dung chưa đạt yêu cầu"
            }

        Shortcut:
            REVIEWING -> IN_PROGRESS
        """
        task = self.get_object()

        reason = (
            request.data.get("reason")
            or request.data.get("rejection_reason")
        )

        if not reason or not str(reason).strip():
            raise ValidationError(
                {
                    "reason": "Rejection reason is required."
                }
            )

        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=Task.Status.IN_PROGRESS,
            reason=str(reason).strip(),
            request=request,
        )

        output_serializer = ManagerTaskDetailSerializer(updated_task)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel_task(self, request, pk=None):
        """
        POST /api/manager/tasks/{id}/cancel/

        Body:
            {
                "reason": "Task is no longer needed"
            }

        Chỉ được cancel khi task chưa COMPLETED/CANCELLED.
        Rule cụ thể nằm trong state machine.
        """
        task = self.get_object()

        reason = request.data.get("reason")

        if not reason or not str(reason).strip():
            raise ValidationError(
                {
                    "reason": "Cancellation reason is required."
                }
            )

        updated_task = apply_transition(
            user=request.user,
            task=task,
            to_status=Task.Status.CANCELLED,
            reason=str(reason).strip(),
            request=request,
        )

        output_serializer = ManagerTaskDetailSerializer(updated_task)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="move")
    def move_task(self, request, pk=None):
        """
        POST /api/manager/tasks/{id}/move/

        Body:
            {
                "to_status": "IN_PROGRESS",
                "prev_task_id": null,
                "next_task_id": 12,
                "reason": "optional"
            }

        FR-39:
        - Reorder cùng cột: chỉ đổi order_index.
        - Kéo sang cột khác: phải qua state machine.
        """
        task = self.get_object()

        serializer = ManagerKanbanMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        moved_task = move_task_kanban(
            user=request.user,
            task=task,
            to_status=serializer.validated_data.get("to_status"),
            prev_task_id=serializer.validated_data.get("prev_task_id"),
            next_task_id=serializer.validated_data.get("next_task_id"),
            reason=serializer.validated_data.get("reason"),
            request=request,
        )

        output_serializer = ManagerTaskDetailSerializer(moved_task)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        """
        GET  /api/manager/tasks/{id}/comments/
        POST /api/manager/tasks/{id}/comments/

        User nhập comment thường luôn bị ép comment_type=NORMAL.
        REJECTION_NOTE chỉ được tạo bởi reject workflow.
        """
        task = self.get_object()

        if request.method == "GET":
            comments = (
                task.comments
                .select_related("user", "user__profile")
                .order_by("created_at")
            )

            serializer = ManagerTaskCommentSerializer(
                comments,
                many=True,
            )

            return Response(
                serializer.data,
                status=status.HTTP_200_OK,
            )

        serializer = ManagerTaskCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            comment = serializer.save(
                task=task,
                user=request.user,
                comment_type=TaskComment.CommentType.NORMAL,
            )

            recipients = resolve_task_recipients(
                task,
                exclude_user=request.user,
            )

            notify(
                recipients=recipients,
                event_type=Notification.EventType.TASK_COMMENT,
                title="New task comment",
                content=f"New comment on task: {task.title}",
                related_url=f"/manager/tasks/{task.id}",
                channel=Notification.ChannelType.SYSTEM_ONLY,
            )

        output_serializer = ManagerTaskCommentSerializer(comment)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        """
        GET  /api/manager/tasks/{id}/attachments/
        POST /api/manager/tasks/{id}/attachments/

        Giai đoạn này lưu metadata file:
        - file_name
        - file_url
        - file_size

        File vật lý xử lý bởi File Storage Service ở bước tích hợp sau.
        """
        task = self.get_object()

        if request.method == "GET":
            attachments = (
                task.attachments
                .select_related("user", "user__profile")
                .order_by("-uploaded_at")
            )

            serializer = ManagerTaskAttachmentSerializer(
                attachments,
                many=True,
            )

            return Response(
                serializer.data,
                status=status.HTTP_200_OK,
            )

        serializer = ManagerTaskAttachmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            attachment = serializer.save(
                task=task,
                user=request.user,
            )

            log_action(
                user=request.user,
                action="UPLOAD_TASK_ATTACHMENT",
                table_name="task_attachments",
                record_id=attachment.id,
                old_values=None,
                new_values=snapshot(attachment),
                request=request,
            )

            recipients = resolve_task_recipients(
                task,
                exclude_user=request.user,
            )

            notify(
                recipients=recipients,
                event_type=Notification.EventType.TASK_ATTACHMENT,
                title="New task attachment",
                content=f"New attachment uploaded to task: {task.title}",
                related_url=f"/manager/tasks/{task.id}",
                channel=Notification.ChannelType.SYSTEM_ONLY,
            )

        output_serializer = ManagerTaskAttachmentSerializer(attachment)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="followers")
    def followers(self, request, pk=None):
        """
        GET /api/manager/tasks/{id}/followers/
        """
        task = self.get_object()

        followers = (
            TaskFollower.objects.filter(task=task)
            .select_related("user", "user__profile")
            .order_by("joined_at")
        )

        data = []

        for follower in followers:
            profile = getattr(follower.user, "profile", None)

            data.append(
                {
                    "id": follower.user.id,
                    "email": follower.user.email,
                    "full_name": (
                        profile.full_name
                        if profile and profile.full_name
                        else follower.user.email
                    ),
                    "joined_at": follower.joined_at,
                }
            )

        return Response(
            data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="follow")
    def follow(self, request, pk=None):
        """
        POST /api/manager/tasks/{id}/follow/
        """
        task = self.get_object()

        follower, created = TaskFollower.objects.get_or_create(
            task=task,
            user=request.user,
        )

        return Response(
            {
                "followed": True,
                "created": created,
                "task_id": task.id,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="unfollow")
    def unfollow(self, request, pk=None):
        """
        POST /api/manager/tasks/{id}/unfollow/

        Dùng POST thay vì DELETE để giữ http_method_names không mở DELETE task.
        """
        task = self.get_object()

        deleted_count, _ = TaskFollower.objects.filter(
            task=task,
            user=request.user,
        ).delete()

        return Response(
            {
                "followed": False,
                "deleted": deleted_count > 0,
                "task_id": task.id,
            },
            status=status.HTTP_200_OK,
        )


class ManagerJobKanbanView(APIView):
    """
    Kanban board theo Job.

    GET /api/manager/jobs/{job_id}/kanban/
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "task:view"  # <--- Khai báo cứng quyền cho toàn bộ class này

    def get(self, request, job_id):
        job = get_scoped_object_or_404(
            scoped_jobs(request.user),
            pk=job_id,
        )

        tasks = (
            scoped_tasks(request.user)
            .filter(job_id=job.id)
            .select_related(
                "job",
                "assignee",
                "assignee__profile",
                "creator",
                "creator__profile",
            )
            .annotate(
                comment_count=Count("comments", distinct=True),
                attachment_count=Count("attachments", distinct=True),
            )
            .order_by("status", "order_index")
        )

        grouped = {
            status_value: []
            for status_value, status_label in Task.Status.choices
        }

        for status_value, status_label in Task.Status.choices:
            status_tasks = [
                task
                for task in tasks
                if task.status == status_value
            ]

            grouped[status_value] = ManagerTaskListSerializer(
                status_tasks,
                many=True,
            ).data

        return Response(
            {
                "job": {
                    "id": job.id,
                    "job_name": job.job_name,
                    "status": job.status,
                    "deadline": job.deadline,
                },
                "columns": grouped,
            },
            status=status.HTTP_200_OK,
        )