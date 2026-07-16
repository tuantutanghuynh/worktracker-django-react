from rest_framework import serializers
from .models import Client, Job


# Bộ dịch dữ liệu cho model Client.
# Chuyển đổi object Client (Python) ↔ JSON (để trả về API hoặc nhận từ request).
# fields = '__all__': tự động lấy tất cả các cột trong bảng clients, không cần khai báo từng trường thủ công.
class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'


# Bộ dịch dữ liệu cho model Job.
# Tương tự ClientSerializer — trả về toàn bộ thông tin của một dự án.
class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = '__all__'
    
    def validate_client(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign job to an inactive client")
        return value