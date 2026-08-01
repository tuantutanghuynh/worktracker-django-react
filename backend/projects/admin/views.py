from rest_framework import viewsets

from ..models import Client, Job
from .serializers import ClientSerializer, JobSerializer
from accounts.permissions import HasPermission
from system.utils import log_audit_event


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer

    def get_queryset(self):
        qs = Client.objects.all()
        params=self.request.query_params
        if name := params.get('name'):
            qs = qs.filter(name__icontains=name)
        if (is_active := params.get('is_active')) is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs
    
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
            record_id=instance.id,
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
            request=self.request,
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
            record_id=instance.id,
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
            request=self.request,
        )

    def perform_destroy(self, instance):
        old_values = JobSerializer(instance).data
        instance.status = 'CANCELLED'
        instance.save()
        log_audit_event(
            actor=self.request.user,
            action='DELETE',
            table_name='jobs',
            record_id=instance.id,
            old_values=old_values,
            request=self.request,
        )
