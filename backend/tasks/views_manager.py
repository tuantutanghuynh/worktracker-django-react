# tasks/views.py
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from tasks.models import Task, TaskComment
from tasks.serializers_manager import TaskSerializer, RejectTaskSerializer
from system.permissions_manager import IsManager, IsJobManager

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsManager, IsJobManager]

    def get_queryset(self):
        # FR-40: Cô lập dữ liệu ở cấp độ Database, Manager chỉ quét các task thuộc dự án mình cầm
        return Task.objects.filter(job__manager=self.request.user).select_related('job', 'assignee', 'creator')

    def perform_create(self, serializer):
        # BR-12: Tự động gán Manager đang đăng nhập làm người tạo task
        serializer.save(creator=self.request.user)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve_task(self, request, pk=None):
        """
        FR-41: Phê duyệt công việc hoàn thành.
        POST /api/v1/manager/tasks/{id}/approve/
        """
        task = self.get_object()
        if task.status != 'REVIEWING':
            return Response({"error": "Chỉ có thể duyệt các công việc đang ở trạng thái REVIEWING."}, status=status.HTTP_400_BAD_REQUEST)

        task.status = 'COMPLETED'
        task.completed_at = timezone.now()
        task.save(update_fields=['status', 'completed_at', 'updated_at'])

        return Response({"message": "Đã phê duyệt công việc thành công.", "status": task.status})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject_task(self, request, pk=None):
        """
        FR-41, BR-16: Từ chối nghiệm thu, trả về IN_PROGRESS và tạo comment lý do.
        POST /api/v1/manager/tasks/{id}/reject/
        Body: {"rejection_reason": "Nội dung chưa đạt yêu cầu..."}
        """
        task = self.get_object()
        if task.status != 'REVIEWING':
            return Response({"error": "Chỉ có thể từ chối các công việc đang ở trạng thái REVIEWING."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RejectTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['rejection_reason']

        with transaction.atomic():
            task.status = 'IN_PROGRESS'
            task.save(update_fields=['status', 'updated_at'])

            # Tạo bản ghi lịch sử thảo luận
            TaskComment.objects.create(
                task=task,
                user=request.user,
                content=f"[TỪ CHỐI NGHIỆM THU]: {reason}"
            )

        return Response({"message": "Đã trả lại công việc cho nhân viên.", "status": task.status})