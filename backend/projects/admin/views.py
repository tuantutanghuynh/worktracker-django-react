from django.core.cache import cache
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

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
            qs = qs.filter(client_name__icontains=name)
        if (is_active := params.get('is_active')) is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs
    
    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('client:create')]
        if self.action == 'destroy':
            return [HasPermission('client:delete')]
        return [HasPermission('client:update')]

    @transaction.atomic
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

    @transaction.atomic
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

    @transaction.atomic
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

    @transaction.atomic
    @action(detail=True, methods=['patch'], url_path='restore')
    def restore(self, request, pk=None):
        client = self.get_object()
        if client.is_active:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Client is already active.')
        old_values = ClientSerializer(client).data
        client.is_active = True
        client.save()
        log_audit_event(
            actor=request.user,
            action='UPDATE',
            table_name='clients',
            record_id=client.id,
            old_values=old_values,
            new_values=ClientSerializer(client).data,
            request=request,
        )
        return Response({'detail': 'Client restored.'}, status=status.HTTP_200_OK)


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('job:create')]
        return [HasPermission('job:update')]

    @transaction.atomic
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

    @transaction.atomic
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

    @transaction.atomic
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
        
    @action(detail=True, methods=['post'], url_path='acquire-lock')
    def acquire_lock(self, request, pk=None):
        key = f'job_lock:{pk}'
        existing = cache.get(key)
        if existing and existing != request.user.id:
            return Response(
                {'detail': 'Job đang được sửa bởi người khác.'},
                status=status.HTTP_423_LOCKED,
            )
        cache.set(key, request.user.id, timeout=300)
        return Response({'detail': 'Lock acquired.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='release-lock')
    def release_lock(self, request, pk=None):
        key = f'job_lock:{pk}'
        cache.delete(key)
        return Response({'detail': 'Lock released.'}, status=status.HTTP_200_OK)
