from django.db import models
from django.conf import settings

# BẢNG 12: tasks (Công việc chi tiết - Trái tim của Bảng Kanban)
class Task(models.Model):
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    ]

    STATUS_CHOICES = [
        ('TODO', 'To Do'),
        ('IN_PROGRESS', 'In Progress'),
        ('REVIEWING', 'Reviewing'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

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
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM', db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='TODO', db_index=True)
    
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
    # Xóa Task thì xóa luôn luồng comment
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    
    # Chặn xóa tài khoản nếu họ đã từng comment để bảo tồn lịch sử thảo luận
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.RESTRICT, related_name='task_comments')
    
    content = models.TextField()
    
    # Đánh INDEX để tối ưu truy xuất luồng chat theo thứ tự thời gian
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"Comment by {self.user} on {self.task.title}"