"""
Module: system.employee.views_employee
Description: Employee-facing API views for managing personal notifications and reviewing personal audit logs.
"""

from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from system.models import Notification, AuditLog
from system.employee.serializers_employee import NotificationSerializer, EmployeeAuditLogSerializer
from accounts.permissions import HasPermission


class NotificationListView(APIView):
    """Retrieve list of notification messages destined for the authenticated employee."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return personal notifications ordered by creation date descending."""
        notifications = Notification.objects.filter(
            user=request.user
        ).order_by("-created_at")

        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    """Mark an individual notification as read for the authenticated employee."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        """Update is_read status to True for specified notification."""
        notification = get_object_or_404(
            Notification, id=notification_id, user=request.user
        )

        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response(
            NotificationSerializer(notification).data, status=status.HTTP_200_OK
        )


class NotificationMarkAllReadView(APIView):
    """Mark all unread notifications as read for the authenticated employee."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        """Update is_read flag for all unread notifications of the current employee."""
        updated_count = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response(
            {"marked_read": updated_count}, status=status.HTTP_200_OK
        )

    def post(self, request):
        """Proxy post requests to patch handler."""
        return self.patch(request)


class EmployeeAuditLogListView(APIView):
    """Retrieve audit log records representing actions performed strictly by the employee."""
    permission_classes = [HasPermission]
    required_permission = "audit:view"

    def get(self, request):
        """Return self-audit logs ordered by creation date descending."""
        logs = AuditLog.objects.filter(user=request.user).order_by("-created_at")
        serializer = EmployeeAuditLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
