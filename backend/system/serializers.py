from rest_framework import serializers
from .models import AuditLog


# Bộ dịch dữ liệu cho model AuditLog.
# Chuyển đổi object AuditLog (Python) → JSON để trả về API. AuditLog chỉ được đọc (không tạo/sửa qua API), nên serializer này chỉ được dùng để serialize dữ liệu đầu ra, không nhận dữ liệu đầu vào.
# fields = '__all__': trả về tất cả các cột của bảng audit_logs.

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'
