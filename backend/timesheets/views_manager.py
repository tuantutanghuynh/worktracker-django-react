from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.response import Response

from timesheets.models import LogWork, TimeLock
from timesheets.serializers_manager import (
    ManagerLogWorkApproveSerializer,
    ManagerLogWorkCorrectSerializer,
    ManagerLogWorkDetailSerializer,
    ManagerLogWorkListSerializer,
    ManagerLogWorkRejectSerializer,
    ManagerLogWorkVoidSerializer,
    ManagerTimeLockCreateSerializer,
    ManagerTimeLockDetailSerializer,
    ManagerTimeLockListSerializer,
    ManagerTimeLockUnlockSerializer,
)
from timesheets.filters_manager import (
    ManagerLogWorkFilter,
    ManagerTimeLockFilter,
)
from timesheets.services.logwork_review_manager_service import (
    approve_logwork,
    correct_logwork,
    reject_logwork,
    void_logwork,
)
from timesheets.services.timelock_manager_service import (
    lock_job_period,
    unlock_job_period,
)

from system.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
from system.scoping_manager import (
    get_scoped_object_or_404,
    scoped_jobs,
    scoped_logworks,
    scoped_timelocks,
)


class ManagerLogWorkViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Manager LogWork Review API.

    Scope chính thức:
        logwork.task.job.manager_id = request.user.id
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]

    http_method_names = [
        "get",
        "post",
        "head",
        "options",
    ]

    def get_permissions(self):
        action_permissions = {
            "list": "timesheet:view",
            "retrieve": "timesheet:view",
            "approve": "timesheet:review",
            "reject": "timesheet:review",
            "correct": "timesheet:correct",
            "void": "timesheet:void",
        }
        self.required_permission = action_permissions.get(self.action)
        return super().get_permissions()

    def get_queryset(self):
        return (
            scoped_logworks(self.request.user)
            .select_related(
                "task",
                "task__job",
                "task__job__client",
                "user",
                "user__profile",
                "reviewed_by",
                "reviewed_by__profile",
                "adjusted_by",
                "adjusted_by__profile",
            )
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ManagerLogWorkListSerializer

        if self.action == "approve":
            return ManagerLogWorkApproveSerializer

        if self.action == "reject":
            return ManagerLogWorkRejectSerializer

        if self.action == "correct":
            return ManagerLogWorkCorrectSerializer

        if self.action == "void":
            return ManagerLogWorkVoidSerializer

        return ManagerLogWorkDetailSerializer

    def list(self, request, *args, **kwargs):
        """
        GET /api/manager/log-works/
        """
        queryset = self.get_queryset()
        queryset = ManagerLogWorkFilter.apply(
            queryset,
            request.query_params,
        )

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ManagerLogWorkListSerializer(
                page,
                many=True,
            )
            return self.get_paginated_response(serializer.data)

        serializer = ManagerLogWorkListSerializer(
            queryset,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        """
        GET /api/manager/log-works/{id}/
        """
        logwork = self.get_object()
        serializer = ManagerLogWorkDetailSerializer(logwork)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """
        POST /api/manager/log-works/{id}/approve/

        Body:
            {
                "note": "optional"
            }
        """
        logwork = self.get_object()

        serializer = ManagerLogWorkApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_logwork = approve_logwork(
            user=request.user,
            logwork=logwork,
            note=serializer.validated_data.get("note"),
            request=request,
        )

        output_serializer = ManagerLogWorkDetailSerializer(updated_logwork)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """
        POST /api/manager/log-works/{id}/reject/

        Body:
            {
                "reason": "Sai nội dung log work"
            }
        """
        logwork = self.get_object()

        serializer = ManagerLogWorkRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_logwork = reject_logwork(
            user=request.user,
            logwork=logwork,
            reason=serializer.validated_data["reason"],
            request=request,
        )

        output_serializer = ManagerLogWorkDetailSerializer(updated_logwork)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="correct")
    def correct(self, request, pk=None):
        """
        POST /api/manager/log-works/{id}/correct/

        Body:
            {
                "hours_spent": "7.50",
                "description": "Corrected description",
                "adjustment_reason": "Sai số giờ"
            }
        """
        logwork = self.get_object()

        serializer = ManagerLogWorkCorrectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_logwork = correct_logwork(
            user=request.user,
            logwork=logwork,
            hours_spent=serializer.validated_data.get("hours_spent"),
            description=serializer.validated_data.get("description"),
            adjustment_reason=serializer.validated_data["adjustment_reason"],
            request=request,
        )

        output_serializer = ManagerLogWorkDetailSerializer(updated_logwork)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        """
        POST /api/manager/log-works/{id}/void/

        Body:
            {
                "reason": "Log work bị nhập sai"
            }
        """
        logwork = self.get_object()

        serializer = ManagerLogWorkVoidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_logwork = void_logwork(
            user=request.user,
            logwork=logwork,
            reason=serializer.validated_data["reason"],
            request=request,
        )

        output_serializer = ManagerLogWorkDetailSerializer(updated_logwork)

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )


class ManagerTimeLockViewSet(viewsets.ModelViewSet):
    """
    Manager JOB TimeLock API.

    Scope chính thức:
        time_lock.lock_scope = JOB
        time_lock.job.manager_id = request.user.id

    Manager không xử lý GLOBAL lock.
    GLOBAL lock thuộc Admin.
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]

    http_method_names = [
        "get",
        "post",
        "head",
        "options",
    ]

    def get_permissions(self):
        action_permissions = {
            "list": "timelock:view",
            "retrieve": "timelock:view",
            "create": "timelock:lock",
            "unlock": "timelock:unlock",
        }
        self.required_permission = action_permissions.get(self.action)
        return super().get_permissions()
    
    def get_queryset(self):
        return (
            scoped_timelocks(self.request.user)
            .select_related(
                "job",
                "job__client",
                "locked_by",
                "locked_by__profile",
                "unlocked_by",
                "unlocked_by__profile",
            )
        )

    def get_serializer_class(self):
        if self.action == "create":
            return ManagerTimeLockCreateSerializer

        if self.action == "unlock":
            return ManagerTimeLockUnlockSerializer

        if self.action == "list":
            return ManagerTimeLockListSerializer

        return ManagerTimeLockDetailSerializer

    def list(self, request, *args, **kwargs):
        """
        GET /api/manager/time-locks/
        """
        queryset = self.get_queryset()
        queryset = ManagerTimeLockFilter.apply(
            queryset,
            request.query_params,
        )

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ManagerTimeLockListSerializer(
                page,
                many=True,
            )
            return self.get_paginated_response(serializer.data)

        serializer = ManagerTimeLockListSerializer(
            queryset,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        """
        GET /api/manager/time-locks/{id}/
        """
        time_lock = self.get_object()
        serializer = ManagerTimeLockDetailSerializer(time_lock)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        """
        POST /api/manager/time-locks/

        Body:
            {
                "job_id": 1,
                "lock_month": 7,
                "lock_year": 2026,
                "reason": "Close July timesheet"
            }
        """
        serializer = ManagerTimeLockCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job = get_scoped_object_or_404(
            scoped_jobs(request.user),
            pk=serializer.validated_data["job_id"],
        )

        time_lock = lock_job_period(
            user=request.user,
            job=job,
            lock_month=serializer.validated_data["lock_month"],
            lock_year=serializer.validated_data["lock_year"],
            reason=serializer.validated_data.get("reason"),
            request=request,
        )

        output_serializer = ManagerTimeLockDetailSerializer(time_lock)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        """
        Không dùng PATCH cho TimeLock.

        Unlock phải đi qua endpoint riêng:
            POST /api/manager/time-locks/{id}/unlock/
        """
        raise MethodNotAllowed("PATCH")

    def destroy(self, request, *args, **kwargs):
        """
        Không xóa vật lý TimeLock.

        Unlock chỉ đổi is_locked=False và ghi audit.
        """
        raise MethodNotAllowed("DELETE")

    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        """
        POST /api/manager/time-locks/{id}/unlock/

        Body:
            {
                "reason": "Need correction"
            }
        """
        time_lock = self.get_object()

        serializer = ManagerTimeLockUnlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        unlocked_time_lock = unlock_job_period(
            user=request.user,
            time_lock=time_lock,
            reason=serializer.validated_data["reason"],
            request=request,
        )

        output_serializer = ManagerTimeLockDetailSerializer(
            unlocked_time_lock,
        )

        return Response(
            output_serializer.data,
            status=status.HTTP_200_OK,
        )


# ============================================================
# Compatibility aliases
# Giữ lại để tránh vỡ import nếu nơi khác còn import tên cũ.
# ============================================================

LogWorkViewSet = ManagerLogWorkViewSet
TimeLockViewSet = ManagerTimeLockViewSet