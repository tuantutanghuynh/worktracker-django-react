from django.conf import settings
from django.db import models


# ============================================================
# BẢNG 8: clients
# Danh mục Khách hàng / Đối tác gốc
# Là root business entity cho jobs.
# Áp dụng soft delete (is_active) thay vì xóa vật lý
# để bảo toàn dữ liệu lịch sử của các job đã liên kết.
# ============================================================
class Client(models.Model):
    client_name = models.CharField(max_length=255)

    # UNIQUE + INDEX phục vụ tìm kiếm và đảm bảo không trùng mã số thuế
    tax_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    contact_person = models.CharField(
        max_length=150,
        blank=True,
        null=True,
    )
    contact_email = models.EmailField(
        max_length=155,
        blank=True,
        null=True,
    )
    contact_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    # Cờ Soft Delete. Chuyển về False thay vì xóa vật lý.
    # INDEX để filter active/inactive nhanh.
    is_active = models.BooleanField(
        default=True,
        db_index=True,

    )
    
    # ➕ --- CÁC TRƯỜNG MỞ RỘNG ĐỀ XUẤT NÂNG CẤP (ENTERPRISE EXTENSIONS) ---
    address = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )  # Địa chỉ trụ sở / Địa chỉ xuất hóa đơn

    industry = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )  # Lĩnh vực hoạt động (IT, Banking, Finance...)

    notes = models.TextField(
        blank=True,
        null=True,
    )  # Ghi chú nội bộ / Lưu ý khi hợp tác

    created_at = models.DateTimeField(
        auto_now_add=True
    )  # Ngày khởi tạo bản ghi

    updated_at = models.DateTimeField(
        auto_now=True
    )  # Ngày cập nhật thông tin gần nhất

    class Meta:
        db_table = "clients"

    def __str__(self):
        return self.client_name


# ============================================================
# BẢNG 9: jobs
# Danh mục Dự án / Gói công việc lớn (master job).
#
# Lưu ý quan trọng:
# jobs.manager_id là field DUY NHẤT được dùng để tính
# Manager access scope trên toàn hệ thống (jobs, tasks,
# timesheets, reports). Không dùng departments.manager_id
# cho mục đích này (xem FR-31, FR-99, FR-117).
# ============================================================
class Job(models.Model):

    class Priority(models.TextChoices):
        HIGH   = 'HIGH',   'High'
        MEDIUM = 'MEDIUM', 'Medium'
        LOW    = 'LOW',    'Low'

    # ENUM trạng thái dự án (FR-29: Job Status Management)
    class Status(models.TextChoices):
        PLANNING = "PLANNING", "Planning"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        ON_HOLD = "ON_HOLD", "On Hold"
        CANCELLED = "CANCELLED", "Cancelled"

    # Khóa ngoại trỏ đến Khách hàng.
    # RESTRICT để chặn xóa khách hàng nếu đang có dự án liên kết.
    client = models.ForeignKey(
        Client,
        on_delete=models.RESTRICT,
        related_name="jobs",
    )

    # Khóa ngoại trỏ đến User (Manager phụ trách).
    # Dùng settings.AUTH_USER_MODEL thay vì import CustomUser trực tiếp
    # để tránh circular import giữa các app.
    # RESTRICT để bảo vệ lịch sử công việc.
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="managed_jobs",
    )

    job_code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    job_name = models.CharField(max_length=255)

    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,

    )
    
    description = models.TextField(
        blank=True,
        null=True,
    )

    start_date = models.DateField()

    # INDEX để tối ưu tốc độ quét dự án trễ hạn (overdue job lookup).
    deadline = models.DateField(db_index=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "jobs"

    def __str__(self):
        return self.job_name