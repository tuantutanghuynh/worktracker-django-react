"""
Module: tasks.models
Description: Database models for task work items, followers, discussion comments, and file attachments.
"""

from django.conf import settings
from django.db import models


class Task(models.Model):
    """Represents a discrete unit of work assigned to a team member within a project job."""

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

    job = models.ForeignKey(
        "projects.Job",
        on_delete=models.RESTRICT,
        related_name="tasks",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="assigned_tasks",
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="created_tasks",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
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
    deadline = models.DateField(db_index=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    order_index = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tasks"

    def __str__(self):
        """Return the task title."""
        return self.title


class TaskFollower(models.Model):
    """Tracks users following task progress for notification routing."""

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
        constraints = [
            models.UniqueConstraint(
                fields=["task", "user"],
                name="unique_task_follower",
            )
        ]

    def __str__(self):
        """Return user and followed task identifiers."""
        return f"{self.user_id} follows task {self.task_id}"


class TaskComment(models.Model):
    """Stores discussion messages and rejection notes linked to a task."""

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
    comment_type = models.CharField(
        max_length=20,
        choices=CommentType.choices,
        default=CommentType.NORMAL,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "task_comments"

    def __str__(self):
        """Return comment type and author identifier."""
        return f"[{self.comment_type}] on task {self.task_id} by {self.user_id}"


class TaskAttachment(models.Model):
    """Metadata record referencing uploaded file attachments associated with a task."""

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
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
        """Return the attachment file name."""
        return self.file_name