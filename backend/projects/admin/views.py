from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Client, Job
from .serializers import ClientSerializer, JobSerializer
from accounts.permissions import HasPermission
from system.security.permissions_manager import IsAdminRole
from system.pagination import AdminPageNumberPagination
from system.utils import log_audit_event
from system.services.admin_report_export_service import (
    build_xlsx_response,
    CLIENT_HEADERS,
    client_rows,
    JOB_HEADERS,
    job_rows,
)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    pagination_class = AdminPageNumberPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['client_name', 'tax_code', 'contact_email', 'is_active', 'created_at']

    def get_queryset(self):
        # Explicit default order — required for pagination to be stable
        # across pages (Postgres doesn't guarantee row order without one),
        # overridden by OrderingFilter whenever ?ordering= is passed.
        qs = Client.objects.order_by('-created_at')
        params=self.request.query_params
        if name := params.get('name'):
            qs = qs.filter(client_name__icontains=name)
        if (is_active := params.get('is_active')) not in (None, ''):
            qs = qs.filter(is_active=is_active.lower() == 'true')
        # Single quick-search box on the frontend — ORs across the 3 fields
        # shown in the Clients table, unlike ?name= which only matches one.
        if search := params.get('search'):
            qs = qs.filter(
                Q(client_name__icontains=search) |
                Q(tax_code__icontains=search) |
                Q(contact_email__icontains=search)
            )
        return qs

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminRole(), HasPermission('client:create')]
        if self.action == 'destroy':
            return [IsAdminRole(), HasPermission('client:delete')]
        if self.action == 'export':
            return [IsAdminRole(), HasPermission('client:export')]
        if self.action in ('list', 'retrieve'):
            return [IsAdminRole(), HasPermission('client:view')]
        return [IsAdminRole(), HasPermission('client:update')]

    # GET /api/admin/clients/export/ — same ?name=/?is_active=/?search=/?ordering=
    # params as the list endpoint, so the file matches what's on screen.
    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        log_audit_event(
            actor=request.user,
            action='EXPORT',
            table_name='clients',
            record_id=0,
            new_values={'filters': dict(request.query_params), 'row_count': queryset.count()},
            request=request,
        )
        return build_xlsx_response(
            sheet_title='Clients',
            headers=CLIENT_HEADERS,
            rows=client_rows(queryset),
            filename='worktracker_clients.xlsx',
        )

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
    pagination_class = AdminPageNumberPagination
    filter_backends = [filters.OrderingFilter]
    # __ lookups let OrderingFilter sort by a related row's field (e.g. the
    # client's name) even though Job only stores client_id/manager_id.
    ordering_fields = [
        'job_name', 'client__client_name', 'manager__email',
        'status', 'priority', 'deadline', 'start_date',
    ]

    def get_queryset(self):
        # See ClientViewSet.get_queryset() — same reason for an explicit default order.
        qs = Job.objects.select_related('client', 'manager').order_by('-created_at')
        if search := self.request.query_params.get('search'):
            qs = qs.filter(
                Q(job_name__icontains=search) |
                Q(client__client_name__icontains=search) |
                Q(manager__email__icontains=search)
            )
        return qs

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminRole(), HasPermission('job:create')]
        if self.action == 'destroy':
            return [IsAdminRole(), HasPermission('job:delete')]
        if self.action == 'export':
            return [IsAdminRole(), HasPermission('job:export')]
        if self.action in ('list', 'retrieve'):
            return [IsAdminRole(), HasPermission('job:view')]
        return [IsAdminRole(), HasPermission('job:update')]

    # GET /api/admin/jobs/export/ — same ?search=/?ordering= params as list.
    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        log_audit_event(
            actor=request.user,
            action='EXPORT',
            table_name='jobs',
            record_id=0,
            new_values={'filters': dict(request.query_params), 'row_count': queryset.count()},
            request=request,
        )
        return build_xlsx_response(
            sheet_title='Jobs',
            headers=JOB_HEADERS,
            rows=job_rows(queryset),
            filename='worktracker_jobs.xlsx',
        )

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
