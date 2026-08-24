from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from system.models import AuditLog, Notification
from system.security.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
from system.security.scoping_manager import manager_job_ids, scoped_audit_logs
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


class ManagerNotificationDeleteView(APIView):
    """
    DELETE /api/manager/system/notifications/{id}/

    Xóa một thông báo của Manager.
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def delete(self, request, notification_id):
        deleted, _ = Notification.objects.filter(
            pk=notification_id,
            user=request.user,
        ).delete()

        if not deleted:
            raise NotFound("Không tìm thấy thông báo cần xóa.")

        return Response(
            {"id": notification_id, "deleted": True},
            status=status.HTTP_200_OK,
        )


class ManagerNotificationBatchDeleteView(APIView):
    """
    POST /api/manager/system/notifications/delete-batch/

    Xóa hàng loạt thông báo được chọn của Manager.
    Body: { "ids": [1, 2, 3] }
    """

    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def post(self, request):
        ids = request.data.get("ids", [])
        if not isinstance(ids, list):
            ids = [ids]

        deleted_count, _ = Notification.objects.filter(
            id__in=ids,
            user=request.user,
        ).delete()

        return Response(
            {"deleted_count": deleted_count},
            status=status.HTTP_200_OK,
        )


# ============================================================
# Audit Log API
# ============================================================

class ManagerAuditLogListView(APIView):
    """
    GET /api/manager/system/audit-logs/

    Tra cứu Audit Log liên quan đến scope của Manager.
    Bao gồm:
    - Các hành động do chính Manager thực hiện.
    - Các hành động của nhân viên trên Job/Task/Timesheet/TimeLock thuộc scope của Manager.

    Query Params:
        - table_name (optional): lọc theo bảng (VD: tasks, jobs, log_works, time_locks, reports).
        - action (optional): lọc theo loại hành động (VD: APPROVE, REJECT, LOCK, REPORT).
        - severity (optional): lọc theo mức độ nghiêm trọng (CRITICAL, WARNING, NORMAL).
        - search (optional): tìm kiếm từ khóa trong summary, action, table_name, actor.
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
        qs = (
            scoped_audit_logs(request.user)
            .select_related("user", "user__profile")
            .order_by("-created_at")
        )

        # 1. Lọc theo bảng linh hoạt
        table_name = request.query_params.get("table_name")
        if table_name:
            table_lower = table_name.lower().strip()
            if table_lower in ["timesheets", "timesheet", "log_works", "log_work"]:
                qs = qs.filter(Q(table_name="log_works") | Q(table_name="timesheets"))
            elif table_lower in ["timelocks", "timelock", "time_locks", "time_lock"]:
                qs = qs.filter(Q(table_name="time_locks") | Q(table_name="timelocks"))
            elif table_lower in ["users", "user", "accounts_customuser", "profile"]:
                qs = qs.filter(
                    Q(table_name="accounts_customuser")
                    | Q(table_name="users")
                    | Q(table_name="employeeprofile")
                )
            elif table_lower in ["reports", "report"]:
                qs = qs.filter(table_name="reports")
            else:
                qs = qs.filter(table_name__icontains=table_lower)

        # 2. Lọc theo hành động (Hỗ trợ từ khóa / tiền tố: APPROVE, REJECT, LOCK, UNLOCK, REPORT, CREATE, UPDATE, DELETE)
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action__icontains=action.strip())

        # 3. Lọc theo mức độ nghiêm trọng (CRITICAL, WARNING, NORMAL)
        severity = request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity.upper().strip())

        # 4. Lọc theo ID bản ghi
        record_id = request.query_params.get("record_id")
        if record_id:
            try:
                qs = qs.filter(record_id=int(record_id))
            except (ValueError, TypeError):
                pass

        # 5. Tìm kiếm từ khóa (Search query)
        search = request.query_params.get("search")
        if search:
            s = search.strip()
            qs = qs.filter(
                Q(summary__icontains=s)
                | Q(action__icontains=s)
                | Q(table_name__icontains=s)
                | Q(user__email__icontains=s)
                | Q(user__profile__full_name__icontains=s)
                | Q(ip_address__icontains=s)
            )

        # 6. Lọc theo khoảng thời gian
        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        serializer = ManagerAuditLogSerializer(qs, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)
