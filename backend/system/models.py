from django.conf import settings
from django.db import models


# ============================================================
# BẢNG 11: audit_logs
# Nhật ký kiểm toán hệ thống.
# Ghi nhận các hành động nhạy cảm (CREATE_JOB, LOCK_TIMESHEET,
# SOFT_DELETE_CLIENT, ...) phục vụ truy vết và đối soát.
#
# Lưu ý:
# - Dùng BIGINT vì volume log có thể lớn theo thời gian.
# - user_id dùng SET NULL để giữ vết log ngay cả khi user bị xóa.
# - ip_address nullable theo §6.3.11: các action chạy ngầm
#   (Celery, system-triggered) có thể không có request IP.
# ============================================================
class AuditLog(models.Model):

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

    # Tên hành động: 'CREATE_JOB', 'SOFT_DELETE_CLIENT', 'LOCK_TIMESHEET', ...
    action = models.CharField(max_length=50)
    severity = models.CharField(
        max_length=10,
        choices=Severity.choices,
        default=Severity.NORMAL,
        db_index=True,
    )
    summary = models.TextField(blank=True, null=True)

    # Tên bảng bị tác động. Phải khớp tên bảng vật lý trong DB
    # (vd: 'jobs', 'clients', 'tasks'), KHÔNG phải tên Django model.
    table_name = models.CharField(max_length=50)

    # ID của bản ghi bị tác động trong bảng table_name.
    record_id = models.IntegerField()

    # Snapshot dữ liệu trước/sau khi thay đổi.
    old_values = models.JSONField(blank=True, null=True)
    new_values = models.JSONField(blank=True, null=True)

    # Cho phép NULL khi action được trigger bởi background process (Celery)
    # hoặc system-triggered action không có request context.
    ip_address = models.GenericIPAddressField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        indexes = [
            # Truy vấn lịch sử của một record cụ thể (vd: mọi thay đổi của job ID 42)
            models.Index(fields=["table_name", "record_id"]),
            # Truy vết theo user theo thứ tự thời gian
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.action} on {self.table_name} (ID: {self.record_id})"


# ============================================================
# BẢNG 16: notifications
# Trung tâm thông báo và hàng đợi email.
# Persist cả khi realtime delivery thất bại (FR-69, FR-119).
#
# Lưu ý quan trọng theo §6.3.17:
# - event_type (what happened) và type (how delivered) là 2 field
#   ĐỘC LẬP. Không được conflate. Vd: TASK_ASSIGNED có thể được
#   gửi qua SYSTEM_ONLY hoặc EMAIL_ONLY hoặc ALL.
# - Dùng BIGINT vì volume notification có thể lớn.
# ============================================================
class Notification(models.Model):
    # Kênh phân phối: notification được gửi qua đâu.
    class ChannelType(models.TextChoices):
        SYSTEM_ONLY = "SYSTEM_ONLY", "System Only"
        EMAIL_ONLY = "EMAIL_ONLY", "Email Only"
        ALL = "ALL", "All Channels"

    # Loại sự kiện nghiệp vụ. Dùng cho filter, routing, UI icon/text.
    # Theo FR-69, FR-119 và §6.4.17.
    class EventType(models.TextChoices):
        TASK_ASSIGNED = "TASK_ASSIGNED", "Task Assigned"
        TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED", "Task Status Changed"
        TASK_COMMENT = "TASK_COMMENT", "Task Comment"
        TASK_SUBMITTED = "TASK_SUBMITTED", "Task Submitted"
        TASK_APPROVED = "TASK_APPROVED", "Task Approved"
        TASK_REJECTED = "TASK_REJECTED", "Task Rejected"
        TASK_ATTACHMENT = "TASK_ATTACHMENT", "Task Attachment"
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

    # Kênh phân phối (HOW it was delivered).
    type = models.CharField(
        max_length=50,
        choices=ChannelType.choices,
        default=ChannelType.SYSTEM_ONLY,
    )

    # Loại sự kiện (WHAT happened).
    # KHÔNG đặt default để buộc code gọi tường minh, tránh tạo
    # notification mặc định sai event_type.
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        db_index=True,
    )

    title = models.CharField(max_length=255)
    content = models.TextField(blank=True, null=True)

    # URL điều hướng khi user click vào notification.
    related_url = models.CharField(max_length=255, blank=True, null=True)

    is_read = models.BooleanField(default=False)
    is_sent_email = models.BooleanField(default=False)
    sent_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "notifications"

    def __str__(self):
        return f"[{self.event_type}] {self.title} → {self.user_id}"