from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


# ============================================================
# BẢNG 10: time_locks
# Khóa kỳ báo cáo timesheet theo tháng/năm.
#
# Theo §6.3.10 và §6.4.10 (bản mới):
# - Hỗ trợ 2 phạm vi lock:
#   + GLOBAL: khóa toàn hệ thống cho tháng/năm đó (chỉ Admin).
#     Khi đó job_id PHẢI là NULL.
#   + JOB: khóa riêng cho 1 dự án (Manager có thể tạo).
#     Khi đó job_id PHẢI khác NULL.
# - Phải có lý do unlock (unlock_reason) khi mở khóa lại.
# ============================================================
class TimeLock(models.Model):
    class LockScope(models.TextChoices):
        JOB = "JOB", "Job Scope"
        GLOBAL = "GLOBAL", "Global Scope"

    lock_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )
    lock_year = models.PositiveSmallIntegerField()

    # Phạm vi lock (JOB hoặc GLOBAL). Mặc định JOB theo spec.
    lock_scope = models.CharField(
        max_length=10,
        choices=LockScope.choices,
        default=LockScope.JOB,
    )

    # Required khi lock_scope=JOB; NULL khi lock_scope=GLOBAL.
    # Ràng buộc này được enforce bởi CheckConstraint phía dưới.
    job = models.ForeignKey(
        "projects.Job",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="time_locks",
    )

    is_locked = models.BooleanField(default=True)

    # User đã thực hiện lock.
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="executed_locks",
    )
    locked_at = models.DateTimeField(auto_now_add=True)
    lock_reason = models.TextField(blank=True, null=True)

    # User đã unlock gần nhất. SET NULL để giữ history khi user bị xóa.
    unlocked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="executed_unlocks",
    )
    unlocked_at = models.DateTimeField(blank=True, null=True)
    # Required ở tầng service khi unlock (spec §6.4.10).
    unlock_reason = models.TextField(blank=True, null=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "time_locks"
        constraints = [
            # Partial unique #1: GLOBAL lock - mỗi tháng/năm chỉ có 1 bản ghi.
            models.UniqueConstraint(
                fields=["lock_month", "lock_year"],
                condition=models.Q(lock_scope="GLOBAL", job__isnull=True),
                name="unique_global_lock_per_month",
            ),
            # Partial unique #2: JOB lock - mỗi tháng/năm/job chỉ có 1 bản ghi.
            models.UniqueConstraint(
                fields=["lock_month", "lock_year", "job"],
                condition=models.Q(lock_scope="JOB", job__isnull=False),
                name="unique_job_lock_per_month_year",
            ),
            # Đảm bảo tương quan: GLOBAL <-> job NULL, JOB <-> job NOT NULL.
            # Chống tạo lock "lơ lửng" không khóa được gì.
            models.CheckConstraint(
                condition=(
                    models.Q(lock_scope="GLOBAL", job__isnull=True)
                    | models.Q(lock_scope="JOB", job__isnull=False)
                ),
                name="check_lock_scope_job_consistency",
            ),
        ]

    def __str__(self):
        scope_label = f"{self.lock_scope}"
        if self.lock_scope == self.LockScope.JOB and self.job_id:
            scope_label += f" (job={self.job_id})"
        status = "LOCKED" if self.is_locked else "UNLOCKED"
        return f"{scope_label} {self.lock_month}/{self.lock_year} - {status}"


# ============================================================
# BẢNG 15: log_works
# Nhật ký giờ làm việc của user trên từng task.
#
# Theo FR-62 (bản mới) + CS-09:
# - KHÔNG xóa vật lý. Xóa = set review_status='VOIDED'.
# - Có cơ chế review (Manager APPROVE/REJECT) tách biệt khỏi
#   cơ chế adjust (correct/void) - được ghi nhận bởi 2 cặp
#   field reviewed_by/reviewed_at và adjusted_by/adjusted_at.
# - Dùng BIGINT vì timesheet record có thể tăng nhanh.
# ============================================================
class LogWork(models.Model):
    class ReviewStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        VOIDED = "VOIDED", "Voided"

    id = models.BigAutoField(primary_key=True)

    task = models.ForeignKey(
        "tasks.Task",
        on_delete=models.RESTRICT,
        related_name="work_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="work_logs",
    )

    work_date = models.DateField()
    # DECIMAL(4,2) để tránh sai số float khi cộng dồn giờ.
    hours_spent = models.DecimalField(max_digits=4, decimal_places=2)
    description = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ---- Review workflow (Manager duyệt timesheet) ----
    review_status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_logworks",
    )
    reviewed_at = models.DateTimeField(blank=True, null=True)
    review_note = models.TextField(blank=True, null=True)

    # ---- Adjustment / void (correct hoặc void bản ghi sai) ----
    adjusted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="adjusted_logworks",
    )
    adjusted_at = models.DateTimeField(blank=True, null=True)
    # Required ở tầng service khi adjust/void để đảm bảo audit traceability.
    adjustment_reason = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "log_works"
        constraints = [
            # Backstop check ở DB (Django đã enforce qua choices ở app layer).
            models.CheckConstraint(
                condition=models.Q(
                    review_status__in=["PENDING", "APPROVED", "REJECTED", "VOIDED"]
                ),
                name="check_logwork_review_status_valid",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} - {self.work_date}: {self.hours_spent}h [{self.review_status}]"


# ============================================================
# BẢNG 15B: daily_user_timesheets
# Tổng giờ làm trong ngày của mỗi user.
# Phục vụ check không vượt 24h/ngày và chống race condition khi
# log work đồng thời (xem §6.7.6 - dùng SELECT ... FOR UPDATE).
#
# Lưu ý: bản ghi VOIDED không được tính vào total_hours,
# logic này do tầng service xử lý khi recalculate.
# ============================================================
class DailyUserTimesheet(models.Model):
    # RESTRICT (không CASCADE) để bảo toàn dữ liệu giờ làm lịch sử
    # khi user bị xóa - nhất quán với log_works.user_id.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="daily_timesheets",
    )
    work_date = models.DateField()
    total_hours = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=0.00,
    )

    class Meta:
        db_table = "daily_user_timesheets"
        constraints = [
            # Mỗi user chỉ có 1 bản ghi tổng cho mỗi ngày.
            models.UniqueConstraint(
                fields=["user", "work_date"],
                name="unique_daily_user_timesheet",
            ),
            # CHECK total_hours <= 24 (§6.7.2).
            models.CheckConstraint(
                condition=models.Q(total_hours__lte=24),
                name="check_total_hours_max_24",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} on {self.work_date}: {self.total_hours}h"