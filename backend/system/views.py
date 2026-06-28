from rest_framework import viewsets

from .models import AuditLog
from . serializers import AuditLog

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer


