from rest_framework import viewsets
from rest_framework.views import APIView

from rest_framework.response import Response

from django.db.models import Sum

from accounts.permissions import HasPermission
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
    serializer_class = AuditLogSerializer
    
    def get_permissions(self):
        return [HasPermission('audit:view')]
    
    def get_queryset(self):
        queryset = AuditLog.objects.all().order_by('-created_at')
        
        actor = self.request.query_params.get('actor')
        if actor:
            queryset = queryset.filter(user_id=actor)
            #filter theo user_id
            
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
            #filter theo action
            
        table_name = self.request.query_params.get('table_name')
        if table_name:
            queryset = queryset.filter(table_name=table_name)
            #filter theo tên bảng: clients/jobs/users
            
        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
            # __date__gte: so sánh phần DATE (bỏ giờ phút), >=date_from — kỹ thuật Field Lookup    
            
        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
            #lte = less than or equal
        return queryset