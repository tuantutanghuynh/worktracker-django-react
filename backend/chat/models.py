from django.conf import settings
from django.db import models
from django.utils import timezone


# ============================================================
# BẢNG: chat_rooms
# Đại diện cho một phòng chat (Kênh dự án hoặc Hội thoại 1-1).
# ============================================================
class ChatRoom(models.Model):
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
        if self.room_type == self.RoomType.JOB and self.job:
            return f"Job Channel: {self.name or self.job.job_name}"
        return f"Direct Room #{self.id}: {self.name or '1-on-1'}"


# ============================================================
# BẢNG: chat_participants
# Quản lý thành viên tham gia phòng chat và mốc thời gian đọc tin.
# ============================================================
class ChatParticipant(models.Model):
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
        return f"{self.user} in Room #{self.room_id}"


# ============================================================
# BẢNG: chat_messages
# Lưu trữ tin nhắn và tệp tin đính kèm.
# ============================================================
class ChatMessage(models.Model):
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
        return f"Msg #{self.id} by {self.sender_id} in Room #{self.room_id}: {self.content[:30]}"
