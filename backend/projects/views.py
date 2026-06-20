from rest_framework import viewsets

from .models import Client, Job
from .serializers import ClientSerializer, JobSerializer

# Create your views here.
class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer #lệnh query lấy tất cả client

    def perform_destroy(self, instance):
        instance.is_active = False #soft delete: chỉ đổi trạng thái active thành false rồi save
        instance.save()

class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer #lệnh query toàn bộ job

    
