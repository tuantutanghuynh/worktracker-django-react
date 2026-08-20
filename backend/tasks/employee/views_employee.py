from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404

from tasks.models import Task, TaskAttachment, TaskComment
from tasks.services.file_upload_service import save_task_attachment
from .serializers_employee import (
    EmployeeTaskListSerializer,
    EmployeeTaskDetailSerializer,
    EmployeeTaskStatusUpdateSerializer,
    EmployeeTaskAttachmentSerializer,
    EmployeeTaskCommentSerializer
)

class EmployeeTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet xử lý toàn bộ API Task & Kanban cho Employee.
    Bảo mật: Chỉ trả về Task được giao cho chính user đang đăng nhập (assignee = request.user).
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # 🔒 Chặn xem trộm: Chỉ lấy Task của chính mình
        return Task.objects.filter(
            assignee=self.request.user
        ).select_related('job', 'job__manager').prefetch_related('attachments', 'comments')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EmployeeTaskDetailSerializer
        return EmployeeTaskListSerializer

    @action(detail=True, methods=['patch'], url_path='status')
    def change_status(self, request, pk=None):
        """
        API Kéo thả Kanban: Cập nhật status (TODO -> IN_PROGRESS -> REVIEWING)
        và cập nhật vị trí thẻ (order_index / LexoRank).
        """
        task = self.get_object()
        serializer = EmployeeTaskStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        order_index = serializer.validated_data.get('order_index')

        update_fields = ['status', 'updated_at']
        task.status = new_status
        if order_index:
            task.order_index = order_index
            update_fields.append('order_index')

        task.save(update_fields=update_fields)

        return Response({
            "id": task.id,
            "status": task.status,
            "order_index": task.order_index,
            "message": f"Task status successfully updated to {new_status}."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser], url_path='attachments')
    def upload_deliverable(self, request, pk=None):
        """
        API Nộp sản phẩm bàn giao (Deliverable) khi kéo task sang REVIEWING.
        """
        task = self.get_object()
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {"error": "No file uploaded. Please provide a valid file to attach."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Sử dụng service lưu trữ file chuẩn của hệ thống
        file_data = save_task_attachment(task_id=task.id, uploaded_file=file_obj)

        attachment = TaskAttachment.objects.create(
            task=task,
            user=request.user,
            file_name=file_data['file_name'],
            file_url=file_data['file_url'],
            file_size=file_data['file_size']
        )

        serializer = EmployeeTaskAttachmentSerializer(attachment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def task_comments(self, request, pk=None):
        """
        API Thảo luận & Comment trên Task.
        """
        task = self.get_object()

        if request.method == 'GET':
            comments = task.comments.all().order_by('created_at')
            serializer = EmployeeTaskCommentSerializer(comments, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        content = request.data.get('content', '').strip()
        if not content:
            return Response(
                {"error": "Comment content cannot be empty."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        comment = TaskComment.objects.create(
            task=task,
            user=request.user,
            content=content,
            comment_type=TaskComment.CommentType.NORMAL
        )

        serializer = EmployeeTaskCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)