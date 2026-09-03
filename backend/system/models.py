"""
Module: system.models
Description: Database models for audit trail records and system-wide notifications.
"""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Stores immutable audit logs recording sensitive mutations across system tables."""

    class Severity(models.TextChoices):
        CRITICAL = 'CRITICAL', 'Critical'
        WARNING  = 'WARNING',  'Warning'
        NORMAL   = 'NORMAL',   'Normal'

    id = models.BigAutoField(primary_key=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    action = models.CharField(max_length=50)
    severity = models.CharField(
        max_length=10,
        choices=Severity.choices,
        default=Severity.NORMAL,
        db_index=True,
    )
    summary = models.TextField(blank=True, null=True)
    table_name = models.CharField(max_length=50)
    record_id = models.IntegerField()
    old_values = models.JSONField(blank=True, null=True)
    new_values = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        indexes = [
            models.Index(fields=["table_name", "record_id"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        """Return action, target table name, and record ID."""
        return f"{self.action} on {self.table_name} (ID: {self.record_id})"


class Notification(models.Model):
    """Manages notifications dispatched across in-app WebSocket channels and email streams."""

    class ChannelType(models.TextChoices):
        SYSTEM_ONLY = "SYSTEM_ONLY", "System Only"
        EMAIL_ONLY = "EMAIL_ONLY", "Email Only"
        ALL = "ALL", "All Channels"

    class EventType(models.TextChoices):
        TASK_ASSIGNED = "TASK_ASSIGNED", "Task Assigned"
        TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED", "Task Status Changed"
        TASK_COMMENT = "TASK_COMMENT", "Task Comment"
        TASK_SUBMITTED = "TASK_SUBMITTED", "Task Submitted"
        TASK_APPROVED = "TASK_APPROVED", "Task Approved"
        TASK_REJECTED = "TASK_REJECTED", "Task Rejected"
        TASK_ATTACHMENT = "TASK_ATTACHMENT", "Task Attachment"
        LOG_WORK_SUBMITTED = "LOG_WORK_SUBMITTED", "Log Work Submitted"
        LOG_WORK_APPROVED = "LOG_WORK_APPROVED", "Log Work Approved"
        LOG_WORK_REJECTED = "LOG_WORK_REJECTED", "Log Work Rejected"
        LOG_WORK_VOIDED = "LOG_WORK_VOIDED", "Log Work Voided"
        TIMESHEET_LOCK = "TIMESHEET_LOCK", "Timesheet Lock"
        TIMESHEET_UNLOCK = "TIMESHEET_UNLOCK", "Timesheet Unlock"
        REPORT_EXPORTED = "REPORT_EXPORTED", "Report Exported"
        ACCOUNT_OR_PERMISSION_CHANGED = (
            "ACCOUNT_OR_PERMISSION_CHANGED",
            "Account or Permission Changed",
        )

    id = models.BigAutoField(primary_key=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    type = models.CharField(
        max_length=50,
        choices=ChannelType.choices,
        default=ChannelType.SYSTEM_ONLY,
    )
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True, null=True)
    related_url = models.CharField(max_length=255, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    is_sent_email = models.BooleanField(default=False)
    sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "notifications"

    def __str__(self):
        """Return event type, title, and recipient user ID."""
        return f"[{self.event_type}] {self.title} → {self.user_id}"