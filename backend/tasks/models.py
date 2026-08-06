from django.conf import settings
from django.db import models


# ============================================================
# BẢNG 12: tasks
# Công việc chi tiết - trái tim của bảng Kanban.
# Mỗi task thuộc về một job, một assignee và một creator.
#
# Lưu ý:
# - order_index dùng VARCHAR để hỗ trợ thuật toán
#   lexicographic ordering cho drag-and-drop (FR-39).
# - status transition phải tuân theo bảng §8.1 trong spec
#   (kiểm tra ở tầng service/view, không ở model).
# ============================================================
class Task(models.Model):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"

    class Status(models.TextChoices):
        TODO = "TODO", "To Do"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        REVIEWING = "REVIEWING", "Reviewing"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    # FK trỏ đến jobs. RESTRICT để chặn xóa dự án khi còn task.
    job = models.ForeignKey(
        "projects.Job",
        on_delete=models.RESTRICT,
        related_name="tasks",
    )

    # FK trỏ đến user được giao việc. RESTRICT để bảo toàn lịch sử.
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="assigned_tasks",
    )

    # FK trỏ đến user tạo task (thường là Manager). RESTRICT bảo toàn lịch sử.
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="created_tasks",
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    # INDEX để filter nhanh trên bảng Kanban.
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO,
        db_index=True,
    )

    # INDEX để truy vấn task quá hạn.
    deadline = models.DateField(db_index=True)

    # Thời điểm chuyển sang COMPLETED. Phục vụ tính time-to-completion.
    completed_at = models.DateTimeField(blank=True, null=True)

    # Lexicographic string ordering cho Kanban drag-and-drop (FR-39).
    order_index = models.CharField(max_length=255, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tasks"

    def __str__(self):
        return self.title


# ============================================================
# BẢNG 13: task_followers
# Người theo dõi task - phục vụ routing notification realtime.
# CASCADE cả 2 phía: xóa task hoặc xóa user thì xóa quan hệ follow.
# ============================================================
class TaskFollower(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="followers",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="task_follows",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_followers"
        # Chống một user follow cùng một task nhiều lần (FR-49).
        constraints = [
            models.UniqueConstraint(
                fields=["task", "user"],
                name="unique_task_follower",
            )
        ]

    def __str__(self):
        return f"{self.user_id} follows task {self.task_id}"


# ============================================================
# BẢNG 14: task_comments
# Trung tâm thảo luận và nghiệm thu task.
#
# Lưu ý theo §6.3.14 và FR-41:
# - comment_type phân biệt thảo luận thường (NORMAL) với
#   ghi chú từ chối nghiệm thu (REJECTION_NOTE) để UI và
#   báo cáo render khác nhau.
# - Xóa task -> xóa comment (CASCADE).
# - User comment thì RESTRICT để bảo toàn lịch sử thảo luận.
# ============================================================
class TaskComment(models.Model):
    class CommentType(models.TextChoices):
        NORMAL = "NORMAL", "Normal Discussion"
        REJECTION_NOTE = "REJECTION_NOTE", "Rejection Note"

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="task_comments",
    )

    content = models.TextField()

    # Phân biệt thảo luận thường và ghi chú từ chối (FR-41, FR-44).
    comment_type = models.CharField(
        max_length=20,
        choices=CommentType.choices,
        default=CommentType.NORMAL,
    )

    # INDEX để load luồng chat theo thứ tự thời gian (§6.7.3).
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "task_comments"

    def __str__(self):
        return f"[{self.comment_type}] on task {self.task_id} by {self.user_id}"


# ============================================================
# BẢNG 17: task_attachments
# Metadata file đính kèm task.
# File vật lý lưu ở file storage service - DB chỉ lưu URL.
# ============================================================
class TaskAttachment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    # User upload. RESTRICT để bảo toàn vết upload.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="uploaded_attachments",
    )

    file_name = models.CharField(max_length=255)
    file_url = models.CharField(max_length=500)
    file_size = models.IntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_attachments"

    def __str__(self):
        return self.file_name