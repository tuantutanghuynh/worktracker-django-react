from rest_framework import viewsets

from accounts.permissions import HasPermission
from system.utils import log_audit_event
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

    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('client:create')]
        return [HasPermission('client:update')]
        
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action='CREATE',
            table_name='clients',
            record_id = instance.id,
            new_values=serializer.data,
            request=self.request,
        )
    
    def perform_update(self, serializer):
        old_values = ClientSerializer(self.get_object()).data
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action='UPDATE',
            table_name='clients',
            record_id=instance.id,
            old_values=old_values,
            new_values=serializer.data,
            request=self.request
        )
    
    def perform_destroy(self, instance):
        old_values = ClientSerializer(instance).data
        instance.is_active = False
        instance.save()
        log_audit_event(
            actor=self.request.user,
            action='DELETE',
            table_name='clients',
            record_id=instance.id,
            old_values=old_values,
            request=self.request,
        )


# Xử lý toàn bộ API CRUD cho Dự án (Job).
# Dùng xóa vật lý mặc định (không override perform_destroy)
# vì Job không áp dụng soft delete.
class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('job:create')]
        return [HasPermission('job:update')]
        
    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action='CREATE',
            table_name='jobs',
            record_id = instance.id,
            new_values=serializer.data,
            request=self.request,
        )
    
    def perform_update(self, serializer):
        old_values = JobSerializer(self.get_object()).data
        instance = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action='UPDATE',
            table_name='jobs',
            record_id=instance.id,
            old_values=old_values,
            new_values=serializer.data,
            request=self.request
        )
    
    def perform_destroy(self, instance):
        old_values = JobSerializer(instance).data
        instance.status = 'CANCELLED'
        instance.save()
        log_audit_event(
            actor=self.request.user,
            action='CANCELLED',
            table_name='jobs',
            record_id=instance.id,
            old_values=old_values,
            request=self.request,
        )
    