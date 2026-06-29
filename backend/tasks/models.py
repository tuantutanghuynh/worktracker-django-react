from django.db import models
from django.conf import settings

# BẢNG 12: tasks (Công việc chi tiết - Trái tim của Bảng Kanban)
class Task(models.Model):
    class Priority(models.TextChoices): 
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    class Status(models.TextChoices):  
        TODO = 'TODO', 'To Do'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        REVIEWING = 'REVIEWING', 'Reviewing'
        COMPLETED = 'COMPLETED', 'Completed'
        ON_HOLD = 'ON_HOLD', 'On Hold'  # <-- Đã bổ sung theo FR Revision 2
        CANCELLED = 'CANCELLED', 'Cancelled'

    # FK trỏ đến jobs. Chặn xóa dự án nếu bên trong đã có Task
    job = models.ForeignKey(
        'projects.Job', 
        on_delete=models.RESTRICT,
        related_name='tasks'
    )
    
    # FK trỏ đến users. Chặn xóa tài khoản nhân viên nếu họ vẫn đang cầm Task
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.RESTRICT,
        related_name='assigned_tasks'
    )
    
    # FK trỏ đến users. Chặn xóa Manager tạo task
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.RESTRICT,
        related_name='created_tasks'
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    
    # Các cờ ưu tiên và trạng thái, bắt buộc đánh INDEX để filter nhanh trên bảng Kanban
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TODO, db_index=True)
    
    deadline = models.DateField(db_index=True)
    
    # Ghi nhận thời khắc chuyển status sang 'COMPLETED'
    completed_at = models.DateTimeField(blank=True, null=True)
    
    # Lexicographical String Indexing cho Drag & Drop, đánh INDEX
    order_index = models.CharField(max_length=255, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


# BẢNG 13: task_followers (Mạng lưới Người theo dõi - Phục vụ Realtime)
class TaskFollower(models.Model):
    # Xóa Task thì tự động xóa danh sách follower
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='followers')
    
    # Xóa User thì tự động xóa liên kết follower
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='task_follows')
    
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ràng buộc UNIQUE(task_id, user_id) để chống sinh rác dữ liệu
        constraints = [
            models.UniqueConstraint(
                fields=['task', 'user'],
                name='unique_task_follower'
            )
        ]

    def __str__(self):
        return f"{self.user} follows {self.task.title}"


# BẢNG 14: task_comments (Trung tâm Thảo luận & Nghiệm thu)
class TaskComment(models.Model):
    class CommentType(models.TextChoices):
        NORMAL = 'NORMAL', 'Normal Discussion'
        REJECTION_NOTE = 'REJECTION_NOTE', 'Rejection Note'

    # Xóa Task thì xóa luôn luồng comment
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    
    # Chặn xóa tài khoản nếu họ đã từng comment để bảo tồn lịch sử thảo luận
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.RESTRICT, related_name='task_comments')
    
    content = models.TextField()
    
    # <-- Đã bổ sung theo FR-41, FR-44 (DB IMPACT)
    comment_type = models.CharField(
        max_length=20, 
        choices=CommentType.choices, 
        default=CommentType.NORMAL,
        db_index=True
    )

    # Đánh INDEX để tối ưu truy xuất luồng chat theo thứ tự thời gian
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"[{self.comment_type}] Comment by {self.user} on {self.task.title}"