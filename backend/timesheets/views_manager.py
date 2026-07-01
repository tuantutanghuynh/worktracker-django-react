# timesheets/views.py
from rest_framework import viewsets
from timesheets.models import TimeLock
from timesheets.serializers_manager import TimeLockSerializer
from system.permissions_manager import IsManager

class TimeLockViewSet(viewsets.ModelViewSet):
    """
    FR-64: API cho phép Manager khóa/mở khóa kỳ chấm công.
    """
    queryset = TimeLock.objects.all()
    serializer_class = TimeLockSerializer
    permission_classes = [IsManager]

    def perform_create(self, serializer):
        # FR-67: Tự động ghi nhận tài khoản Manager thực hiện lệnh khóa
        serializer.save(locked_by=self.request.user)