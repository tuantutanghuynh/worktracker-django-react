"""
Module: timesheets.models
Description: Database models for monthly period time-locking, employee work logs, and daily hour tracking.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class TimeLock(models.Model):
    """Enforces period locking for work hour submissions at global or per-project scopes."""

    class LockScope(models.TextChoices):
        JOB = "JOB", "Job Scope"
        GLOBAL = "GLOBAL", "Global Scope"

    lock_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )
    lock_year = models.PositiveSmallIntegerField()
    lock_scope = models.CharField(
        max_length=10,
        choices=LockScope.choices,
        default=LockScope.JOB,
    )
    job = models.ForeignKey(
        "projects.Job",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="time_locks",
    )
    is_locked = models.BooleanField(default=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="executed_locks",
    )
    locked_at = models.DateTimeField(auto_now_add=True)
    lock_reason = models.TextField(blank=True, null=True)
    unlocked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="executed_unlocks",
    )
    unlocked_at = models.DateTimeField(blank=True, null=True)
    unlock_reason = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "time_locks"
        constraints = [
            models.UniqueConstraint(
                fields=["lock_month", "lock_year"],
                condition=models.Q(lock_scope="GLOBAL", job__isnull=True),
                name="unique_global_lock_per_month",
            ),
            models.UniqueConstraint(
                fields=["lock_month", "lock_year", "job"],
                condition=models.Q(lock_scope="JOB", job__isnull=False),
                name="unique_job_lock_per_month_year",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(lock_scope="GLOBAL", job__isnull=True)
                    | models.Q(lock_scope="JOB", job__isnull=False)
                ),
                name="check_lock_scope_job_consistency",
            ),
        ]

    def __str__(self):
        """Return formatted scope, period month/year, and lock status."""
        scope_label = f"{self.lock_scope}"
        if self.lock_scope == self.LockScope.JOB and self.job_id:
            scope_label += f" (job={self.job_id})"
        status = "LOCKED" if self.is_locked else "UNLOCKED"
        return f"{scope_label} {self.lock_month}/{self.lock_year} - {status}"


class LogWork(models.Model):
    """Records individual work hour submissions logged by employees against specific tasks."""

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

    work_date = models.DateField(db_index=True)
    hours_spent = models.DecimalField(max_digits=4, decimal_places=2)
    description = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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

    adjusted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="adjusted_logworks",
    )
    adjusted_at = models.DateTimeField(blank=True, null=True)
    adjustment_reason = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "log_works"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    review_status__in=["PENDING", "APPROVED", "REJECTED", "VOIDED"]
                ),
                name="check_logwork_review_status_valid",
            ),
        ]

    def __str__(self):
        """Return formatted user, date, logged hours, and review status."""
        return f"{self.user_id} - {self.work_date}: {self.hours_spent}h [{self.review_status}]"


class DailyUserTimesheet(models.Model):
    """Maintains aggregated daily work hours per employee to enforce daily 24-hour limits."""

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
            models.UniqueConstraint(
                fields=["user", "work_date"],
                name="unique_daily_user_timesheet",
            ),
            models.CheckConstraint(
                condition=models.Q(total_hours__lte=24),
                name="check_total_hours_max_24",
            ),
        ]

    def __str__(self):
        """Return formatted user, work date, and cumulative total daily hours."""
        return f"{self.user_id} on {self.work_date}: {self.total_hours}h"