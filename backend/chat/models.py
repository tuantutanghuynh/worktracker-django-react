"""
Module: chat.models
Description: Database models for chat rooms, participants, and message history.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class ChatRoom(models.Model):
    """Represents a chat channel for project jobs or 1-on-1 direct conversations."""

    class RoomType(models.TextChoices):
        JOB = "JOB", "Job Channel"
        DIRECT = "DIRECT", "Direct Message"

    room_type = models.CharField(
        max_length=10,
        choices=RoomType.choices,
        default=RoomType.DIRECT,
        db_index=True,
    )
    job = models.ForeignKey(
        "projects.Job",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chat_rooms",
    )
    name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_rooms"
        ordering = ["-updated_at"]

    def __str__(self):
        """Return formatted room title based on room type."""
        if self.room_type == self.RoomType.JOB and self.job:
            return f"Job Channel: {self.name or self.job.job_name}"
        return f"Direct Room #{self.id}: {self.name or '1-on-1'}"


class ChatParticipant(models.Model):
    """Tracks member participation and last-read timestamps for a chat room."""

    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_participations",
    )
    last_read_at = models.DateTimeField(default=timezone.now)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_participants"
        unique_together = ("room", "user")

    def __str__(self):
        """Return participant user and room identifier."""
        return f"{self.user} in Room #{self.room_id}"


class ChatMessage(models.Model):
    """Stores chat message text, attachments, and creation timestamps."""

    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_chat_messages",
    )
    content = models.TextField(blank=True, default="")
    attachment_url = models.CharField(max_length=500, blank=True, null=True)
    attachment_name = models.CharField(max_length=255, blank=True, null=True)
    attachment_size = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "chat_messages"
        ordering = ["created_at"]

    def __str__(self):
        """Return message sender, room ID, and truncated content preview."""
        return f"Msg #{self.id} by {self.sender_id} in Room #{self.room_id}: {self.content[:30]}"
