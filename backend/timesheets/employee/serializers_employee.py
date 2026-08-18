from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from system.services.audit_manager_service import log_action, snapshot

from timesheets.models import LogWork, DailyUserTimesheet, TimeLock
from tasks.models import Task

# This file holds the EMPLOYEE-only serializers for the timesheets app:
# EmployeeLogWorkSerializer validates and creates a log_work entry, applying
# 3 independent checks — Data Isolation (task must be assigned to the
# caller), Defensive layer 1 (Time Lock, 403 if the period is closed), and
# Defensive layer 2 (24h daily cap via Pessimistic Locking, 400 if
# exceeded).


# Creates a log_work entry for the current user, enforcing Time Lock + 24h
# Cap inside create() (see file header) — not just format validation.
class EmployeeLogWorkSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogWork
        fields = ["id", "task", "work_date", "hours_spent", "description"]
        read_only_fields = ["id"]

    # Rejects hours_spent <= 0.
    def validate_hours_spent(self, value):
        if value <= 0:
            raise serializers.ValidationError("hours_spent must be greater than 0.")
        return value

    # Data Isolation: rejects a task that isn't assigned to the calling user.
    def validate_task(self, task):
        request = self.context["request"]
        if task.assignee_id != request.user.id:
            raise serializers.ValidationError("You can only log work on tasks assigned to you.")
        return task

    # Runs Time Lock check (defensive layer 1), then 24h Cap + Pessimistic
    # Locking (defensive layer 2) inside one transaction before creating
    # the log_work row. PermissionDenied (403) for Time Lock vs
    # ValidationError (400) for the 24h cap — different error classes on
    # purpose, since one is an administrative block and the other is bad
    # input the caller can fix by resubmitting.
    def create(self, validated_data): 
        user = self.context["request"].user
        work_date = validated_data["work_date"]
        hours_spent = validated_data["hours_spent"]

        with transaction.atomic():
            # Defensive layer 1 — Time Lock check (GLOBAL trước, rồi JOB)
            global_lock = TimeLock.objects.filter(
                lock_month=work_date.month,
                lock_year=work_date.year,
                lock_scope=TimeLock.LockScope.GLOBAL,
                job__isnull=True,
            ).first()
            if global_lock and global_lock.is_locked:
                raise PermissionDenied(
                    f"Period {work_date.month}/{work_date.year} is locked (GLOBAL lock). "
                    "Contact your admin to unlock it."
                )

            job_lock = TimeLock.objects.filter(
                lock_month=work_date.month,
                lock_year=work_date.year,
                lock_scope=TimeLock.LockScope.JOB,
                job=validated_data["task"].job_id,
            ).first()
            if job_lock and job_lock.is_locked:
                raise PermissionDenied(
                    f"Period {work_date.month}/{work_date.year} is locked for this job (JOB lock). "
                    "Contact your manager to unlock it."
                )

            # Defensive layer 2 — 24h Cap + Race Condition
            # select_for_update() trước get_or_create() để: nếu row đã tồn tại, get() nội bộ
            # khóa nó luôn trong cùng 1 query; nếu chưa tồn tại, get_or_create() tự lo
            # savepoint + retry khi 2 request cùng tạo mới (xem Django query.py get_or_create()).
            timesheet, _ = DailyUserTimesheet.objects.select_for_update().get_or_create(
                user=user, work_date=work_date, defaults={"total_hours": Decimal("0")}
            )

            new_total = timesheet.total_hours + hours_spent
            if new_total > 24:
                raise serializers.ValidationError(
                    {
                        "hours_spent": (
                            f"Total hours for {work_date} would exceed 24h "
                            f"(currently {timesheet.total_hours}h, tried to add {hours_spent}h)."
                        )
                    }
                )

            timesheet.total_hours = new_total
            timesheet.save()

            validated_data["user"] = user
    
            log_work = super().create(validated_data)

            log_action(
                user=user,
                action="CREATE_LOG_WORK",
                table_name="log_works",
                record_id=log_work.id,
                new_values=snapshot(
                    log_work,
                    fields=["task", "work_date", "hours_spent", "description", "review_status"],
                ),
                request=self.context["request"],
            )

            return log_work

# Task rút gọn — chỉ đủ thông tin để hiển thị 1 dòng trong bảng Timesheet
# (không cần full EmployeeTaskListSerializer, tránh over-fetch).
class EmployeeLogWorkTaskMiniSerializer(serializers.ModelSerializer):
    job_name = serializers.CharField(source="job.job_name", read_only=True)

    class Meta:
        model = Task
        fields = ["id", "title", "job_name"]


# Liệt kê log work của chính user — dùng cho trang Timesheet (bảng chính),
# khác EmployeeLogWorkSerializer (dùng để TẠO, không có nested task).
class EmployeeLogWorkListSerializer(serializers.ModelSerializer):
    task = EmployeeLogWorkTaskMiniSerializer(read_only=True)

    class Meta:
        model = LogWork
        fields = [
            "id", "task", "work_date", "hours_spent", "description",
            "review_status", "review_note", "reviewed_at",
            "adjustment_reason", "created_at",
        ]
