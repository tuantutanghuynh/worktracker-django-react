"""
Module: system.manager.views_manager
Description: Manager endpoints for managing personal notifications and querying team-scoped audit logs.
"""

from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from system.models import AuditLog, Notification
from system.security.permissions_manager import IsActiveAuthenticated, IsManagerRole, HasPermissionCode
from system.security.scoping_manager import scoped_audit_logs
from system.manager.serializers_manager import ManagerAuditLogSerializer, ManagerNotificationSerializer


class ManagerNotificationListView(APIView):
    """Retrieve filtered notification messages destined for the authenticated manager."""
    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def get(self, request):
        """Return notifications filtered by read status and event type."""
        qs = (
            Notification.objects.filter(user=request.user)
            .order_by("-created_at")
        )

        is_read_param = request.query_params.get("is_read")
        if is_read_param is not None:
            is_read = is_read_param.lower() == "true"
            qs = qs.filter(is_read=is_read)

        event_type = request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)

        serializer = ManagerNotificationSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ManagerNotificationMarkReadView(APIView):
    """Mark an individual notification as read for the authenticated manager."""
    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def post(self, request, notification_id):
        """Update is_read status on targeted notification instance."""
        try:
            notification = Notification.objects.get(
                pk=notification_id,
                user=request.user,
            )
        except Notification.DoesNotExist:
            raise NotFound("Notification not found.")

        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response(
            {"id": notification_id, "is_read": True},
            status=status.HTTP_200_OK,
        )


class ManagerNotificationMarkAllReadView(APIView):
    """Mark all unread notifications as read for the authenticated manager."""
    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def post(self, request):
        """Update is_read flag for all unread notifications of the current manager."""
        updated_count = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response(
            {"marked_read": updated_count},
            status=status.HTTP_200_OK,
        )


class ManagerNotificationDeleteView(APIView):
    """Delete an individual notification belonging to the authenticated manager."""
    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def delete(self, request, notification_id):
        """Delete specific notification instance owned by authenticated manager."""
        deleted, _ = Notification.objects.filter(
            pk=notification_id,
            user=request.user,
        ).delete()

        if not deleted:
            raise NotFound("Notification to delete was not found.")

        return Response(
            {"id": notification_id, "deleted": True},
            status=status.HTTP_200_OK,
        )


class ManagerNotificationBatchDeleteView(APIView):
    """Delete multiple notifications by ID belonging to the authenticated manager."""
    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "notification:view"

    def post(self, request):
        """Delete list of notification instances matching provided IDs."""
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


class ManagerAuditLogListView(APIView):
    """Query audit log records restricted to the manager's authorized team scope."""
    permission_classes = [
        IsActiveAuthenticated,
        IsManagerRole,
        HasPermissionCode,
    ]
    required_permission = "report:view"

    def get(self, request):
        """Return scoped audit logs filtered by table, action, severity, search, and date range."""
        qs = (
            scoped_audit_logs(request.user)
            .select_related("user", "user__profile")
            .order_by("-created_at")
        )

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

        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action__icontains=action.strip())

        severity = request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity.upper().strip())

        record_id = request.query_params.get("record_id")
        if record_id:
            try:
                qs = qs.filter(record_id=int(record_id))
            except (ValueError, TypeError):
                pass

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

        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        serializer = ManagerAuditLogSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
