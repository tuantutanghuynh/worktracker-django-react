from django.db.models import Sum
from django.utils import timezone

from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response

from accounts.models import CustomUser
from accounts.permissions import HasPermission
from projects.models import Client, Job
from tasks.models import Task
from timesheets.models import LogWork
from ..models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer

    def get_permissions(self):
        return [HasPermission('audit:view')]

    def get_queryset(self):
        queryset = AuditLog.objects.all().order_by('-created_at')

        actor = self.request.query_params.get('actor')
        if actor:
            queryset = queryset.filter(user_id=actor)

        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)

        table_name = self.request.query_params.get('table_name')
        if table_name:
            queryset = queryset.filter(table_name=table_name)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset


class DashboardView(APIView):

    def get_permissions(self):
        return [HasPermission('audit:view')]

    def get(self, request):
        today = timezone.now().date()

        active_clients = Client.objects.filter(is_active=True).count()
        running_jobs   = Job.objects.filter(status='ACTIVE').count()
        total_users    = CustomUser.objects.filter(is_active=True).count()
        overdue_jobs   = Job.objects.filter(
            deadline__lt=today,
            status__in=['PLANNING', 'ACTIVE', 'ON_HOLD'],
        ).count()

        total_hours = (
            LogWork.objects
            .filter(review_status='APPROVED')
            .aggregate(total=Sum('hours_spent'))['total'] or 0
        )

        jobs_by_status = {
            s: Job.objects.filter(status=s).count()
            for s in ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
        }
        jobs_by_status['OVERDUE'] = overdue_jobs

        clients_overview = {
            'active':   active_clients,
            'inactive': Client.objects.filter(is_active=False).count(),
            'total':    Client.objects.count(),
        }

        task_status = {
            s: Task.objects.filter(status=s).count()
            for s in ['TODO', 'IN_PROGRESS', 'REVIEWING', 'COMPLETED', 'CANCELLED']
        }

        audit_today = AuditLog.objects.filter(created_at__date=today)
        audit_summary_today = {
            'account_created':   audit_today.filter(action='CREATE', table_name='users').count(),
            'account_locked':    audit_today.filter(action='LOCK_ACCOUNT').count(),
            'role_changed':      audit_today.filter(action='ASSIGN_ROLE').count(),
            'deadline_changed':  audit_today.filter(action='UPDATE', table_name='jobs').count(),
            'timesheet_locked':  audit_today.filter(action='LOCK_TIMESHEET').count(),
        }

        return Response({
            'active_clients':      active_clients,
            'running_jobs':        running_jobs,
            'total_work_hours':    total_hours,
            'total_users':         total_users,
            'overdue_jobs':        overdue_jobs,
            'jobs_by_status':      jobs_by_status,
            'clients_overview':    clients_overview,
            'task_status':         task_status,
            'audit_summary_today': audit_summary_today,
        })
