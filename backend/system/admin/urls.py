"""
Module: system.admin.urls
Description: URL route definitions for administration audit logs, dashboard metrics, and alerts.
"""

from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import AuditLogViewSet, DashboardView, DataQualityAlertsView

router = DefaultRouter()
router.register('audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = router.urls + [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('data-quality-alerts/', DataQualityAlertsView.as_view(), name='data-quality-alerts'),
]
