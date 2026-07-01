from rest_framework import viewsets
from .models import AuditLog
from .serializers import AuditLogSerializer


# Xử lý API đọc Nhật ký Kiểm toán — CHỈ ĐỌC (không cho tạo/sửa/xóa qua API).
# ReadOnlyModelViewSet chỉ cung cấp 2 action:
#   - list:     GET /api/system/audit-logs/        → trả về danh sách toàn bộ log
#   - retrieve: GET /api/system/audit-logs/{id}/   → trả về 1 bản ghi log theo id
#
# queryset: lấy toàn bộ AuditLog, sắp xếp theo created_at giảm dần
# (dấu '-' trước tên field = ORDER BY DESC → log mới nhất lên đầu).
# serializer_class: dùng AuditLogSerializer để chuyển kết quả sang JSON.
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
