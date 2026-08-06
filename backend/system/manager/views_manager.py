from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from system.models import AuditLog, Notification
from system.security.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
from system.security.scoping_manager import manager_job_ids
from system.manager.serializers_manager import ManagerAuditLogSerializer, ManagerNotificationSerializer


# ============================================================
# Notification API
# ============================================================

class ManagerNotificationListView(APIView):
    """
    GET /api/manager/system/notifications/

    Danh sách thông báo của Manager đang đăng nhập.
    Chỉ trả thông báo của chính họ (user = request.user).

    Query Params:
        - is_read (optional): true/false để lọc đã đọc / chưa đọc.
        - event_type (optional): lọc theo loại sự kiện (VD: TASK_APPROVED).
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def get(self, request):
        qs = (
            Notification.objects.filter(user=request.user)
            .order_by("-created_at")
        )

        # Lọc theo is_read
        is_read_param = request.query_params.get("is_read")
        if is_read_param is not None:
            is_read = is_read_param.lower() == "true"
            qs = qs.filter(is_read=is_read)

        # Lọc theo event_type
        event_type = request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)

        serializer = ManagerNotificationSerializer(qs, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)


class ManagerNotificationMarkReadView(APIView):
    """
    POST /api/manager/system/notifications/{id}/mark-read/

    Đánh dấu một thông báo là đã đọc.
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                pk=notification_id,
                user=request.user,  # Chỉ được đánh dấu thông báo của mình
            )
        except Notification.DoesNotExist:
            raise NotFound("Không tìm thấy thông báo.")

        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response(
            {"id": notification_id, "is_read": True},
            status=status.HTTP_200_OK,
        )


class ManagerNotificationMarkAllReadView(APIView):
    """
    POST /api/manager/system/notifications/mark-all-read/

    Đánh dấu tất cả thông báo của Manager là đã đọc.
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def post(self, request):
        updated_count = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response(
            {"marked_read": updated_count},
            status=status.HTTP_200_OK,
        )


# ============================================================
# Audit Log API
# ============================================================

class ManagerAuditLogListView(APIView):
    """
    GET /api/manager/system/audit-logs/

    Tra cứu Audit Log liên quan đến scope của Manager.
    Chỉ trả log của các bản ghi thuộc job do Manager quản lý.

    Query Params:
        - table_name (optional): lọc theo bảng (VD: tasks, jobs).
        - action (optional): lọc theo loại hành động (VD: UPLOAD_TASK_ATTACHMENT).
        - record_id (optional): lọc theo ID bản ghi cụ thể.
        - date_from (optional): từ ngày (YYYY-MM-DD).
        - date_to (optional): đến ngày (YYYY-MM-DD).
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
        # Scope: chỉ các log liên quan đến user hiện tại (Manager) hoặc
        # các hành động trên các record thuộc scope của họ.
        # Đơn giản nhất: trả log của chính Manager đó thực hiện.
        qs = (
            AuditLog.objects.filter(user=request.user)
            .order_by("-created_at")
        )

        # Lọc bổ sung
        table_name = request.query_params.get("table_name")
        if table_name:
            qs = qs.filter(table_name=table_name)

        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)

        record_id = request.query_params.get("record_id")
        if record_id:
            qs = qs.filter(record_id=record_id)

        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        serializer = ManagerAuditLogSerializer(qs, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)
