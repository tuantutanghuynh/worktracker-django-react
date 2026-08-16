from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatParticipant, ChatMessage

User = get_user_model()


class ChatUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "department_name"]

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "full_name", None):
            return profile.full_name
        return getattr(obj, "full_name", "") or obj.email.split("@")[0]

    def get_department_name(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and getattr(profile, "department", None):
            return profile.department.name
        return None


class ChatMessageSerializer(serializers.ModelSerializer):
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
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False


class ChatRoomListSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_participant = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    job_code = serializers.CharField(source="job.job_code", read_only=True)
    job_name = serializers.CharField(source="job.job_name", read_only=True)
    job_status = serializers.CharField(source="job.status", read_only=True)
    is_archived = serializers.SerializerMethodField()

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
            "is_archived",
        ]

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by("-created_at").first()
        if last_msg:
            return {
                "id": last_msg.id,
                "content": last_msg.content or (f"[Attachment] {last_msg.attachment_name}" if last_msg.attachment_name else ""),
                "sender_name": getattr(last_msg.sender, "full_name", "") or last_msg.sender.email.split("@")[0],
                "created_at": last_msg.created_at,
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            participant = obj.participants.filter(user=request.user).first()
            if participant:
                return obj.messages.filter(created_at__gt=participant.last_read_at).exclude(sender=request.user).count()
        return 0

    def get_other_participant(self, obj):
        if obj.room_type == ChatRoom.RoomType.DIRECT:
            request = self.context.get("request")
            if request and request.user.is_authenticated:
                other_p = obj.participants.exclude(user=request.user).select_related("user").first()
                if other_p and other_p.user:
                    return ChatUserSerializer(other_p.user).data
        return None

    def get_participants_count(self, obj):
        return obj.participants.count()

    def get_is_archived(self, obj):
        if obj.room_type == ChatRoom.RoomType.JOB and obj.job:
            return obj.job.status in ["COMPLETED", "CANCELLED"]
        return False
