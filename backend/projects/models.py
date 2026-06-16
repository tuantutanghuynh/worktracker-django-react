from django.db import models
from django.conf import settings


# Bảng 8: clients (Danh mục Khách hàng / Đối tác gốc)
class Client(models.Model):
    client_name = models.CharField(max_length=255)
    tax_code = models.CharField(
        max_length=50, unique=True, db_index=True
    )  # Đánh INDEX và UNIQUE phục vụ tìm kiếm 
    contact_person = models.CharField(max_length=150, blank=True, null=True)
    contact_email = models.EmailField(max_length=155, blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)

    # Cờ Soft Delete. Chuyển về False thay vì xóa vật lý
    is_active = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return self.client_name


# Bảng 9: jobs (Danh mục Dự án / Gói công việc lớn) 
class Job(models.Model):
    # Khai báo cấu trúc ENUM cho trạng thái dự án (Giống cơ chế Enum class trong Java)
    STATUS_CHOICES = [
        ("PLANNING", "Planning"),
        ("ACTIVE", "Active"),
        ("COMPLETED", "Completed"),
        ("ON_HOLD", "On Hold"),
        ("CANCELLED", "Cancelled"),
    ]

    # Khóa ngoại trỏ đến Khách hàng. Dùng RESTRICT để chặn xóa khách hàng nếu đang có dự án 
    client = models.ForeignKey(Client, on_delete=models.RESTRICT, related_name="jobs")

    # Khóa ngoại trỏ đến User (Manager). Dùng settings.AUTH_USER_MODEL thay vì import CustomUser trực tiếp 
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.RESTRICT, related_name="managed_jobs"
    )

    job_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField()

    # Đánh INDEX để tối ưu tốc độ quét dự án trễ hạn 
    deadline = models.DateField(db_index=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PLANNING")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.job_name
