from django.db.models import Sum, Q
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
from django.http import HttpResponse
from ..utils import log_audit_event
import openpyxl

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

        if record_id := self.request.query_params.get('record_id'):
            queryset = queryset.filter(record_id=record_id)

        if keyword := self.request.query_params.get('keyword'):
            queryset = queryset.filter(
                Q(old_values__icontains=keyword) | Q(new_values__icontains=keyword)
            )

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

class AdminReportView(APIView):
    def get_permissions(self):
        return [HasPermission('report:export')]
    def get(self, request):
        wb = openpyxl.Workbook()
        ws = wb.active
        #tạo export excel clients 
        ws.title = 'Clients'
        ws.append(['ID', 'Name', 'Tax Code', 'Contact Email', 'Is Active'])
        for c in Client.objects.all():
            ws.append([c.id, c.client_name, c.tax_code, c.contact_email, c.is_active])
        #tạo export sheet jobs
        ws2 = wb.create_sheet('Jobs')
        ws2.append(['ID', 'Name', 'Client', 'Status', 'Priority', 'Start Date', 'Deadline'])
        for j in Job.objects.select_related('client').all():
            ws2.append([j.id, j.job_name, j.client.client_name, j.status, j.priority,
                        str(j.start_date), str(j.deadline)])
        #tạo sheet user
        ws3 = wb.create_sheet('Users')
        ws3.append(['ID', 'Email', 'Role', 'Is Active'])
        for u in CustomUser.objects.select_related('role').all():
            ws3.append([u.id, u.email, u.role.code if u.role else '', u.is_active])            
        log_audit_event(
            actor=request.user,
            action='EXPORT',
            table_name='reports',
            record_id=0,
            request=request,
        )
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="worktracker_report.xlsx"'
        wb.save(response)
        return response