import os
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from projects.models import Job
from tasks.models import Task
from system.models import Notification
from .models import ChatRoom, ChatParticipant, ChatMessage
from .serializers import (
    ChatRoomListSerializer,
    ChatMessageSerializer,
    ChatUserSerializer,
)

User = get_user_model()


import html

# Danh mục định dạng file an toàn và cấm độc hại
ALLOWED_ATTACHMENT_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "rar", "7z",
    "png", "jpg", "jpeg", "webp", "gif", "svg", "csv"
}
BLOCKED_ATTACHMENT_EXTENSIONS = {
    "exe", "bat", "cmd", "sh", "vbs", "msi", "php", "py", "js", "html", "htm", "dll", "com", "scr", "apk", "jar"
}


def sync_user_job_channels(user):
    """
    Tự động đồng bộ các Kênh Dự Án mà user có quyền tham gia:
    - Nếu là Manager của Job -> Tự động vào Kênh Job đó.
    - Nếu là Assignee của Task thuộc Job -> Tự động vào Kênh Job đó.
    """
    if not user.is_authenticated:
        return

    # Lấy tất cả Jobs mà user quản lý hoặc có task được giao
    managed_jobs = Job.objects.filter(manager=user)
    assigned_job_ids = Task.objects.filter(assignee=user).values_list("job_id", flat=True).distinct()
    assigned_jobs = Job.objects.filter(id__in=assigned_job_ids)

    all_user_jobs = (managed_jobs | assigned_jobs).distinct()

    for job in all_user_jobs:
        room_name = f"#{job.job_code or f'JOB-{job.id}'}: {job.job_name}"
        room, _ = ChatRoom.objects.get_or_create(
            room_type=ChatRoom.RoomType.JOB,
            job=job,
            defaults={"name": room_name},
        )
        ChatParticipant.objects.get_or_create(room=room, user=user)


class ChatRoomViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatRoomListSerializer

    def get_queryset(self):
        user = self.request.user
        sync_user_job_channels(user)
        user_role = (user.role.code if getattr(user, "role", None) else "").upper()

        # Nếu là ADMIN: được xem toàn bộ các phòng Direct / Support gửi tới Ban Quản Trị
        if user_role == "ADMIN" or getattr(user, "is_superuser", False):
            return (
                ChatRoom.objects.filter(
                    Q(room_type=ChatRoom.RoomType.JOB, participants__user=user)
                    | Q(room_type=ChatRoom.RoomType.DIRECT, participants__user__role__code="ADMIN", messages__isnull=False)
                    | Q(room_type=ChatRoom.RoomType.DIRECT, participants__user=user, messages__isnull=False)
                )
                .select_related("job")
                .prefetch_related("participants__user", "participants__user__role", "messages")
                .distinct()
                .order_by("-updated_at")
            )

        if self.action == "list":
            return (
                ChatRoom.objects.filter(
                    Q(room_type=ChatRoom.RoomType.JOB, participants__user=user)
                    | Q(room_type=ChatRoom.RoomType.DIRECT, participants__user=user, messages__isnull=False)
                )
                .select_related("job")
                .prefetch_related("participants__user", "messages")
                .distinct()
                .order_by("-updated_at")
            )
        return (
            ChatRoom.objects.filter(participants__user=user)
            .select_related("job")
            .prefetch_related("participants__user", "messages")
            .distinct()
            .order_by("-updated_at")
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Phân loại thành 2 nhóm: job_channels và direct_messages
        job_channels = []
        direct_messages = []

        for item in serializer.data:
            if item["room_type"] == ChatRoom.RoomType.JOB:
                job_channels.append(item)
            else:
                direct_messages.append(item)

        return Response({
            "job_channels": job_channels,
            "direct_messages": direct_messages,
            "total_rooms": len(serializer.data),
        })

    @action(detail=True, methods=["GET"])
    def messages(self, request, pk=None):
        """
        Lấy danh sách tin nhắn của phòng chat và tự động đánh dấu đã đọc.
        """
        room = self.get_object()
        user = request.user

        # Cập nhật last_read_at
        ChatParticipant.objects.filter(room=room, user=user).update(last_read_at=timezone.now())

        # Lấy tối đa 100 tin nhắn gần nhất
        messages_qs = room.messages.select_related("sender", "sender__role").order_by("created_at")[:100]
        serializer = ChatMessageSerializer(messages_qs, many=True, context={"request": request})

        return Response({
            "room_id": room.id,
            "room_name": room.name or (f"#{room.job.job_code}: {room.job.job_name}" if room.job else "Direct Chat"),
            "room_type": room.room_type,
            "is_archived": room.job.status in ["COMPLETED", "CANCELLED"] if (room.room_type == ChatRoom.RoomType.JOB and room.job) else False,
            "messages": serializer.data,
        })

    @action(detail=True, methods=["POST"])
    def send_message(self, request, pk=None):
        """
        Gửi tin nhắn qua REST API (hỗ trợ cả text và file đính kèm) kèm 5 quy tắc Validate dữ liệu an toàn.
        """
        room = self.get_object()
        user = request.user

        # 1. Validate trạng thái tài khoản người gửi
        if not user.is_active:
            return Response({"detail": "Your account is deactivated. Cannot send message."}, status=status.HTTP_403_FORBIDDEN)

        # 2. Validate kênh dự án đã hoàn thành / đóng (Read-only)
        if room.room_type == ChatRoom.RoomType.JOB and room.job:
            if room.job.status in ["COMPLETED", "CANCELLED"]:
                return Response(
                    {"detail": "This project is closed and archived as read-only. New messages are not allowed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 3. Validate tài khoản người nhận trong Chat 1-1 (Nếu người nhận bị khóa)
        if room.room_type == ChatRoom.RoomType.DIRECT:
            other_p = room.participants.exclude(user=user).select_related("user").first()
            if other_p and other_p.user and not other_p.user.is_active:
                return Response(
                    {"detail": "Recipient account is deactivated. Cannot send message."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        raw_content = request.data.get("content", "")
        # 4. Validate độ dài tin nhắn (Tối đa 4,000 ký tự) và chống XSS
        if len(raw_content) > 4000:
            return Response(
                {"detail": "Message content exceeds maximum allowed length of 4,000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = html.escape(raw_content.strip())
        attachment_url = request.data.get("attachment_url", None)
        attachment_name = request.data.get("attachment_name", None)
        attachment_size = request.data.get("attachment_size", None)

        if not content and not attachment_url:
            return Response({"detail": "Message content or attachment is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Lưu tin nhắn vào Database
        message = ChatMessage.objects.create(
            room=room,
            sender=user,
            content=content,
            attachment_url=attachment_url,
            attachment_name=attachment_name,
            attachment_size=attachment_size,
        )

        # Cập nhật updated_at của phòng và last_read_at của người gửi
        room.updated_at = timezone.now()
        room.save(update_fields=["updated_at"])
        ChatParticipant.objects.filter(room=room, user=user).update(last_read_at=timezone.now())

        # Serialize tin nhắn để trả về và broadcast

        # Serialize tin nhắn để trả về và broadcast
        msg_data = ChatMessageSerializer(message, context={"request": request}).data

        # Phát sóng Realtime qua Redis Channel Layer
        channel_layer = get_channel_layer()
        if channel_layer:
            try:
                # 1. Phát sóng tới phòng chat hiện tại
                async_to_sync(channel_layer.group_send)(
                    f"chat_room_{room.id}",
                    {
                        "type": "chat.message",
                        "message": msg_data,
                    },
                )

                # 2. Gửi tín hiệu đồng bộ Badge Sidebar nhẹ tới kênh cá nhân của từng thành viên
                other_participants = room.participants.exclude(user=user)
                for participant in other_participants:
                    async_to_sync(channel_layer.group_send)(
                        f"user_{participant.user_id}",
                        {
                            "type": "notification.message",
                            "payload": {
                                "type": "chat_badge_sync",
                                "room_id": room.id,
                            },
                        },
                    )
            except Exception:
                pass

        return Response(msg_data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["POST"])
    def start_direct(self, request):
        """
        Mở hoặc khởi tạo phòng chat 1-1 với một nhân viên cụ thể.
        """
        target_user_id = request.data.get("target_user_id")
        if not target_user_id:
            return Response({"detail": "target_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response({"detail": "Target user not found."}, status=status.HTTP_404_NOT_FOUND)

        current_user = request.user
        if current_user.id == target_user.id:
            return Response({"detail": "Cannot create direct chat with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        # Tìm phòng 1-1 đã tồn tại giữa 2 người
        existing_rooms = ChatRoom.objects.filter(
            room_type=ChatRoom.RoomType.DIRECT,
            participants__user=current_user,
        ).filter(participants__user=target_user)

        if existing_rooms.exists():
            room = existing_rooms.first()
        else:
            # Tạo phòng mới
            room = ChatRoom.objects.create(
                room_type=ChatRoom.RoomType.DIRECT,
                name=f"DM: {current_user.email} & {target_user.email}",
            )
            ChatParticipant.objects.create(room=room, user=current_user)
            ChatParticipant.objects.create(room=room, user=target_user)

        serializer = ChatRoomListSerializer(room, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["POST"])
    def upload_attachment(self, request):
        """
        Tải file đính kèm lên Server nội bộ an toàn (Giới hạn 20MB & kiểm duyệt định dạng file).
        """
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Kiểm tra dung lượng tối đa 20MB
        if file_obj.size > 20 * 1024 * 1024:
            return Response({"detail": "File size exceeds 20MB limit."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Kiểm duyệt định dạng đuôi file
        filename = file_obj.name or ""
        ext = filename.split(".")[-1].lower() if "." in filename else ""

        if ext in BLOCKED_ATTACHMENT_EXTENSIONS:
            return Response(
                {"detail": f"File type '.{ext}' is strictly blocked for security reasons."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ext and ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
            return Response(
                {"detail": f"File type '.{ext}' is not supported. Please upload documents or images."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Lưu file vào media/chat_attachments/
        upload_dir = os.path.join("chat_attachments", str(request.user.id))
        saved_path = default_storage.save(os.path.join(upload_dir, file_obj.name), file_obj)
        file_url = settings.MEDIA_URL + saved_path

        return Response({
            "attachment_url": file_url,
            "attachment_name": file_obj.name,
            "attachment_size": file_obj.size,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["GET"])
    def directory(self, request):
        """
        Danh sách tất cả đồng nghiệp / nhân sự trong công ty để bắt đầu chat 1-1.
        """
        users = User.objects.exclude(id=request.user.id).filter(is_active=True).select_related("role", "profile")
        serializer = ChatUserSerializer(users, many=True)
        return Response(serializer.data)
