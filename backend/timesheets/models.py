from django.db import models
from django.conf import settings

# BẢNG 10: time_locks (Kiểm soát Chốt sổ & Khóa kỳ báo cáo)
class TimeLock(models.Model):
    # lock_month: Tháng chốt (Giá trị từ 1-12) 
    lock_month = models.PositiveSmallIntegerField()
    
    # lock_year: Năm chốt 
    lock_year = models.PositiveSmallIntegerField()
    
    # is_locked: Cờ trạng thái. True (1): Đã khóa / False (0): Mở khóa 
    is_locked = models.BooleanField(default=True)
    
    # locked_by: FK trỏ đến bảng users. Chặn xóa tài khoản Admin đã từng thực hiện chốt sổ 
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='executed_locks'
    )
    
    # locked_at: Ghi nhận thời điểm thực hiện lệnh chốt sổ
    locked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ràng buộc đặc biệt: Khóa phức hợp UNIQUE (lock_month, lock_year)
        # Triệt tiêu hoàn toàn rủi ro tạo trùng lặp cấu hình khóa cho cùng một tháng
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
    # Sử dụng BIGINT vì dữ liệu bảng này sẽ phình to cực kỳ nhanh mỗi ngày 
    id = models.BigAutoField(primary_key=True)
    
    # Khóa ngoại trỏ đến tasks. Tuyệt đối cấm xóa Task nếu đã có nhân viên Log Work 
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.RESTRICT,
        related_name='work_logs'
    )
    
    # Khóa ngoại trỏ đến users. Tuyệt đối cấm xóa nhân viên để bảo vệ dữ liệu đối soát lương 
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='work_logs'
    )
    
    # Ngày thực tế nhân viên thực hiện công việc 
    work_date = models.DateField()
    
    # Số giờ làm việc (Ví dụ: 8.00, 1.50). Dùng DECIMAL để đảm bảo độ chính xác tuyệt đối 
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
            # Ràng buộc 1: Khóa chính phức hợp
            models.UniqueConstraint(
                fields=['user', 'work_date'],
                name='unique_daily_user_timesheet'
            ),
            # Ràng buộc 2: Sửa 'check' thành 'condition'
            models.CheckConstraint(
                condition=models.Q(total_hours__lte=24), 
                name='check_total_hours_max_24'
            )
        ]

    def __str__(self):
        return f"{self.user} on {self.work_date}: {self.total_hours}h"


# BẢNG 16: notifications (Trung tâm Thông báo & Hàng đợi Email)
class Notification(models.Model):
    # Dùng BIGINT đề phòng dung lượng phình to theo thời gian 
    id = models.BigAutoField(primary_key=True)
    
    # Khóa ngoại trỏ đến users. Áp dụng ON DELETE CASCADE 
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    
    type = models.CharField(max_length=50) # 'SYSTEM_ONLY', 'EMAIL_ONLY', 'ALL' 
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True, null=True)
    related_url = models.CharField(max_length=255, blank=True, null=True)
    
    is_read = models.BooleanField(default=False) # Cờ đánh dấu đã đọc 
    is_sent_email = models.BooleanField(default=False) # Cờ kiểm soát trạng thái gửi Email 
    sent_at = models.DateTimeField(blank=True, null=True) # Ghi nhận thời khắc Email rời máy chủ 
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"Notification for {self.user.email} - {self.title}"


# BẢNG 17: task_attachments (Tài liệu đính kèm - Tùy chọn nâng cao)
class TaskAttachment(models.Model):
    # Khóa ngoại trỏ đến tasks. Áp dụng ON DELETE CASCADE 
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    
    # Khóa ngoại trỏ đến users. Áp dụng ON DELETE RESTRICT
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='uploaded_attachments'
    )
    
    file_name = models.CharField(max_length=255)
    file_url = models.CharField(max_length=500) # Đường dẫn lưu trữ file 
    file_size = models.IntegerField(blank=True, null=True) # Dung lượng file (Byte) 
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file_name