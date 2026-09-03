"""
Module: timesheets.employee.serializers_employee
Description: Serializer definitions for employee work log submission, validation, and historical logging.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from system.services.audit_manager_service import log_action, snapshot
from timesheets.models import LogWork, DailyUserTimesheet, TimeLock
from tasks.models import Task
from timesheets.services.daily_total_manager_service import MAX_DAILY_HOURS


class EmployeeLogWorkSerializer(serializers.ModelSerializer):
    """Serialize and validate new work log submissions enforcing isolation, time lock, and daily cap."""

    class Meta:
        model = LogWork
        fields = ["id", "task", "work_date", "hours_spent", "description"]
        read_only_fields = ["id"]

    def validate_hours_spent(self, value):
        """Ensure logged work hours are strictly greater than zero."""
        if value <= 0:
            raise serializers.ValidationError("hours_spent must be greater than 0.")
        return value

    def validate_work_date(self, value):
        """Reject work log submissions dated in the future."""
        today = timezone.localdate()
        if value > today:
            raise serializers.ValidationError(
                f"Cannot log work for a future date ({value}). "
                f"Today is {today}."
            )
        return value

    def validate_task(self, task):
        """Ensure task is assigned to the submitting employee and parent job is active."""
        request = self.context["request"]
        if task.assignee_id != request.user.id:
            raise serializers.ValidationError("You can only log work on tasks assigned to you.")
        
        from projects.models import Job
        if task.job and task.job.status in [Job.Status.ON_HOLD, Job.Status.CANCELLED, Job.Status.COMPLETED]:
            raise serializers.ValidationError(
                f"Cannot log work on task '{task.title}' because its project '{task.job.job_name}' "
                f"is currently in '{task.job.status}' status."
            )

        if task.status in [Task.Status.REVIEWING, Task.Status.COMPLETED, Task.Status.CANCELLED]:
            raise serializers.ValidationError(
                f"Cannot log work on task '{task.title}' because it is in '{task.status}' status. "
                "Please recall submission or request manager reopen before logging hours."
            )
        return task

    def create(self, validated_data): 
        """Create work log entry with pessimistic locking on daily timesheet and period lock checks."""
        user = self.context["request"].user
        work_date = validated_data["work_date"]
        hours_spent = validated_data["hours_spent"]

        with transaction.atomic():
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

            timesheet, _ = DailyUserTimesheet.objects.select_for_update().get_or_create(
                user=user, work_date=work_date, defaults={"total_hours": Decimal("0")}
            )

            new_total = timesheet.total_hours + hours_spent
            if new_total > MAX_DAILY_HOURS:
                raise serializers.ValidationError(
                    {
                        "hours_spent": (
                            f"Total hours for {work_date} would exceed {MAX_DAILY_HOURS}h "
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


class EmployeeLogWorkTaskMiniSerializer(serializers.ModelSerializer):
    """Serialize minimal task details for embedded display in employee work log rows."""
    job_name = serializers.CharField(source="job.job_name", read_only=True)

    class Meta:
        model = Task
        fields = ["id", "title", "job_name"]


class EmployeeLogWorkListSerializer(serializers.ModelSerializer):
    """Serialize employee work log history items for personal timesheet list views."""
    task = EmployeeLogWorkTaskMiniSerializer(read_only=True)

    class Meta:
        model = LogWork
        fields = [
            "id", "task", "work_date", "hours_spent", "description",
            "review_status", "review_note", "reviewed_at",
            "adjustment_reason", "created_at",
        ]