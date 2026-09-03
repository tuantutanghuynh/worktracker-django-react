"""
Module: projects.models
Description: Data models for client directories, master project jobs, and related entity relationships.
"""

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower, Trim


class Client(models.Model):
    """Represents a client organization or corporate partner."""

    client_name = models.CharField(max_length=255)
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
    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )
    address = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    industry = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )
    notes = models.TextField(
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True
    )
    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "clients"
        constraints = [
            models.UniqueConstraint(
                Lower(Trim("client_name")),
                name="unique_client_name_case_insensitive",
            ),
        ]

    def __str__(self):
        """Return the client name."""
        return self.client_name  


class Job(models.Model):
    """Represents a master project job managed by an assigned manager."""

    class Priority(models.TextChoices):
        HIGH = 'HIGH', 'High'
        MEDIUM = 'MEDIUM', 'Medium'
        LOW = 'LOW', 'Low'

    class Status(models.TextChoices):
        PLANNING = "PLANNING", "Planning"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        ON_HOLD = "ON_HOLD", "On Hold"
        CANCELLED = "CANCELLED", "Cancelled"

    client = models.ForeignKey(
        Client,
        on_delete=models.RESTRICT,
        related_name="jobs",
    )
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
        """Return the job name."""
        return self.job_name