from rest_framework import viewsets
from .models import Client, Job
from .serializers import ClientSerializer, JobSerializer


# Xử lý toàn bộ API CRUD cho Khách hàng (Client).
# ModelViewSet cung cấp sẵn 5 action: list, retrieve, create, update, destroy.
# queryset: câu truy vấn mặc định — lấy tất cả client trong DB.
# serializer_class: dùng ClientSerializer để chuyển đổi dữ liệu sang JSON.
#
# perform_destroy: override hành động xóa mặc định của Django.
# Thay vì xóa vật lý khỏi DB, chỉ đổi is_active = False (soft delete).
# Lý do: giữ lại lịch sử các dự án (Job) đã liên kết với client đó.
class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()


# Xử lý toàn bộ API CRUD cho Dự án (Job).
# Dùng xóa vật lý mặc định (không override perform_destroy)
# vì Job không áp dụng soft delete.
class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
