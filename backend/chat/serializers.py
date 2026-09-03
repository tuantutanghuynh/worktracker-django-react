"""
Module: chat.serializers
Description: Serializers for chat room listings, participants, message history, and user summaries.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatParticipant, ChatMessage

User = get_user_model()


class ChatUserSerializer(serializers.ModelSerializer):
    """Serializer representing user identity, role, department, and avatar in chat interfaces."""

    full_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    role_code = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "role_code", "department_name", "avatar_url"]

    def get_role_code(self, obj):
        """Return role code string for user."""
        if getattr(obj, "role", None):
            return obj.role.code if hasattr(obj.role, "code") else str(obj.role).upper()
        return "EMPLOYEE"

    def get_full_name(self, obj):
        """Return full name from profile or fallback to email prefix."""
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "full_name", None):
            return profile.full_name
        return getattr(obj, "full_name", "") or obj.email.split("@")[0]

    def get_avatar_url(self, obj):
        """Return avatar image URL from profile."""
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "avatar_url", None):
            return profile.avatar_url
        return None

    def get_department_name(self, obj):
        """Return department name from profile with default for admin role."""
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "department", None):
            return profile.department.name
        role_code = self.get_role_code(obj)
        if role_code == "ADMIN":
            return "System & IT Operations"
        return None


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer representing chat messages, attachments, and ownership indicator."""

    sender = ChatUserSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "room",
            "sender",
            "content",
            "attachment_url",
            "attachment_name",
            "attachment_size",
            "created_at",
            "is_mine",
        ]
        read_only_fields = ["id", "sender", "created_at", "is_mine"]

    def get_is_mine(self, obj):
        """Check whether message sender matches the current authenticated user."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False


class ChatRoomListSerializer(serializers.ModelSerializer):
    """Serializer representing chat room overview, unread counts, and participant summaries."""

    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_participant = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    job_code = serializers.CharField(source="job.job_code", read_only=True)
    job_name = serializers.CharField(source="job.job_name", read_only=True)
    job_status = serializers.CharField(source="job.status", read_only=True)
    is_archived = serializers.SerializerMethodField()

    participants = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            "id",
            "room_type",
            "job",
            "job_code",
            "job_name",
            "job_status",
            "name",
            "created_at",
            "updated_at",
            "last_message",
            "unread_count",
            "other_participant",
            "participants_count",
            "participants",
            "is_archived",
        ]

    def get_last_message(self, obj):
        """Return latest message preview dictionary in room."""
        last_msg = obj.messages.select_related("sender", "sender__role").order_by("-created_at").first()
        if last_msg and last_msg.sender:
            sender_role = getattr(last_msg.sender.role, "code", "EMPLOYEE") if getattr(last_msg.sender, "role", None) else ("ADMIN" if last_msg.sender.is_superuser else "EMPLOYEE")
            is_from_admin = (sender_role == "ADMIN") or last_msg.sender.is_superuser
            return {
                "id": last_msg.id,
                "content": last_msg.content or (f"[Attachment] {last_msg.attachment_name}" if last_msg.attachment_name else ""),
                "sender_id": last_msg.sender.id,
                "sender_name": getattr(last_msg.sender, "full_name", "") or last_msg.sender.email.split("@")[0],
                "sender_role": sender_role,
                "is_from_admin": is_from_admin,
                "created_at": last_msg.created_at,
            }
        return None

    def get_unread_count(self, obj):
        """Calculate number of unread messages since user's last-read timestamp."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            participant = obj.participants.filter(user=request.user).first()
            if participant:
                return obj.messages.filter(created_at__gt=participant.last_read_at).exclude(sender=request.user).count()
        return 0

    def get_other_participant(self, obj):
        """Return profile information of opposite participant in 1-on-1 direct rooms."""
        if obj.room_type == ChatRoom.RoomType.DIRECT:
            request = self.context.get("request")
            if request and request.user.is_authenticated:
                other_p = obj.participants.exclude(user=request.user).select_related("user").first()
                if other_p and other_p.user:
                    return ChatUserSerializer(other_p.user).data
        return None

    def get_participants_count(self, obj):
        """Return total count of participants in room."""
        return obj.participants.count()

    def get_participants(self, obj):
        """Return serialized list of all participants in room."""
        participants_qs = obj.participants.select_related(
            "user", "user__role", "user__profile", "user__profile__department"
        ).all()
        result = []
        for p in participants_qs:
            if not p.user:
                continue
            profile = getattr(p.user, "profile", None)
            dept_name = None
            avatar_url = None
            full_name = ""
            phone_number = ""
            if profile:
                full_name = getattr(profile, "full_name", "") or ""
                phone_number = getattr(profile, "phone_number", "") or ""
                avatar_url = getattr(profile, "avatar_url", None)
                if getattr(profile, "department", None):
                    dept_name = profile.department.name
            
            role_code = "EMPLOYEE"
            if getattr(p.user, "role", None):
                role_code = p.user.role.code if hasattr(p.user.role, "code") else str(p.user.role)

            result.append({
                "id": p.user.id,
                "email": p.user.email,
                "full_name": full_name or p.user.email.split("@")[0],
                "avatar_url": avatar_url,
                "role": role_code,
                "department_name": dept_name or "General Staff",
                "phone_number": phone_number,
                "is_active": p.user.is_active,
                "joined_at": p.joined_at,
            })
        return result

    def get_is_archived(self, obj):
        """Return boolean indicating whether job channel is closed or cancelled."""
        if obj.room_type == ChatRoom.RoomType.JOB and obj.job:
            return obj.job.status in ["COMPLETED", "CANCELLED"]
        return False
