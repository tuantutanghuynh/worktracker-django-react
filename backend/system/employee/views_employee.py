from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from system.models import Notification, AuditLog
from system.employee.serializers_employee import NotificationSerializer, EmployeeAuditLogSerializer
from accounts.permissions import HasPermission

# This file holds the EMPLOYEE-facing (any logged-in user, not role-gated)
# notification views: list your own notifications, mark one as read, mark
# all as read.


# Returns the calling user's own notifications, newest first.
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(
            user=request.user
        ).order_by("-created_at")

        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# Marks one of the calling user's own notifications as read.
class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        notification = get_object_or_404(
            Notification, id=notification_id, user=request.user
        )

        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response(
            NotificationSerializer(notification).data, status=status.HTTP_200_OK
        )


# Marks every one of the calling user's own unread notifications as read
# in a single query. Mirrors ManagerNotificationMarkAllReadView's logic
# (system/manager/views_manager.py) but kept as its own class here since
# this file isn't shared code — PATCH to match NotificationMarkReadView
# above, not POST like the Manager version.
class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        updated_count = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response(
            {"marked_read": updated_count}, status=status.HTTP_200_OK
        )


# Nhật ký hoạt động CỦA CHÍNH NGƯỜI GỌI — chỉ audit_logs có user=request.user,
# khác hẳn bản Admin (xem toàn hệ thống) hay Manager (xem cả team quản lý).
class EmployeeAuditLogListView(APIView):
    permission_classes = [HasPermission]
    required_permission = "audit:view"

    def get(self, request):
        logs = AuditLog.objects.filter(user=request.user).order_by("-created_at")
        serializer = EmployeeAuditLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
