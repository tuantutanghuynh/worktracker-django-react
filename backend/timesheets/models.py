from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator   # <-- thêm dòng này
# BẢNG 10: time_locks (Kiểm soát Chốt sổ & Khóa kỳ báo cáo)
class TimeLock(models.Model):
    lock_month = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    lock_year = models.PositiveSmallIntegerField()
    is_locked = models.BooleanField(default=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='executed_locks'
    )
    locked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['lock_month', 'lock_year'], 
                name='unique_lock_month_year'
            )
        ]

    def __str__(self):
        status = "LOCKED" if self.is_locked else "UNLOCKED"
        return f"Kỳ báo cáo {self.lock_month}/{self.lock_year} - Trạng thái: {status}"


# BẢNG 15: log_works (Nhật ký Thời gian làm việc - Timesheet)
class LogWork(models.Model):
    id = models.BigAutoField(primary_key=True)
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.RESTRICT,
        related_name='work_logs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='work_logs'
    )
    work_date = models.DateField()
    hours_spent = models.DecimalField(max_digits=4, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} - {self.work_date}: {self.hours_spent}h"


# BẢNG 15B: daily_user_timesheets (Bảng Tổng hợp Giờ làm - Chống Race Condition)
class DailyUserTimesheet(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_timesheets'
    )
    work_date = models.DateField()
    total_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0.00)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'work_date'],
                name='unique_daily_user_timesheet'
            ),
            models.CheckConstraint(
                condition=models.Q(total_hours__lte=24), 
                name='check_total_hours_max_24'
            )
        ]

    def __str__(self):
        return f"{self.user} on {self.work_date}: {self.total_hours}h"


# BẢNG 16: notifications (Trung tâm Thông báo & Hàng đợi Email)
class Notification(models.Model):
    class ChannelType(models.TextChoices):
        SYSTEM_ONLY = 'SYSTEM_ONLY', 'System Only'
        EMAIL_ONLY = 'EMAIL_ONLY', 'Email Only'
        ALL = 'ALL', 'All Channels'

    # <-- ĐÃ BỔ SUNG THEO FR-69, FR-119: Danh mục sự kiện chuẩn hóa
    class EventType(models.TextChoices):
        TASK_ASSIGNED = 'TASK_ASSIGNED', 'Task Assigned'
        TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED', 'Task Status Changed'
        TASK_COMMENT = 'TASK_COMMENT', 'Task Comment'
        TASK_SUBMITTED = 'TASK_SUBMITTED', 'Task Submitted'
        TASK_APPROVED = 'TASK_APPROVED', 'Task Approved'
        TASK_REJECTED = 'TASK_REJECTED', 'Task Rejected'
        TASK_ATTACHMENT = 'TASK_ATTACHMENT', 'Task Attachment'
        TIMESHEET_LOCK = 'TIMESHEET_LOCK', 'Timesheet Lock'
        TIMESHEET_UNLOCK = 'TIMESHEET_UNLOCK', 'Timesheet Unlock'
        REPORT_EXPORTED = 'REPORT_EXPORTED', 'Report Exported'
        ACCOUNT_OR_PERMISSION_CHANGED = 'ACCOUNT_OR_PERMISSION_CHANGED', 'Account Changed'

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    
    type = models.CharField(max_length=50, choices=ChannelType.choices, default=ChannelType.SYSTEM_ONLY)
    
    # <-- ĐÃ THÊM CỘT MỚI THEO FR-119 (DB IMPACT)
    event_type = models.CharField(
        max_length=50, 
        choices=EventType.choices, 
        default=EventType.TASK_ASSIGNED, 
        db_index=True
    )

    title = models.CharField(max_length=255)
    content = models.TextField(blank=True, null=True)
    related_url = models.CharField(max_length=255, blank=True, null=True)
    
    is_read = models.BooleanField(default=False) 
    is_sent_email = models.BooleanField(default=False) 
    sent_at = models.DateTimeField(blank=True, null=True) 
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"[{self.event_type}] Notification for {self.user.email} - {self.title}"


# BẢNG 17: task_attachments (Tài liệu đính kèm)
class TaskAttachment(models.Model):
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='uploaded_attachments'
    )
    file_name = models.CharField(max_length=255)
    file_url = models.CharField(max_length=500) 
    file_size = models.IntegerField(blank=True, null=True) 
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file_name