from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AuditLogViewSet, DashboardView

router = DefaultRouter()
router.register('audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = router.urls + [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
]
