from rest_framework.routers import DefaultRouter
from .views import AuditLogViewSet

# DefaultRouter tự động tạo URL pattern từ ViewSet đã đăng ký.
router = DefaultRouter()

# Đăng ký AuditLogViewSet với prefix 'audit-logs'.
# Vì dùng ReadOnlyModelViewSet nên router chỉ tạo 2 URL (không có POST/PUT/DELETE):
#   GET /api/system/audit-logs/        → danh sách tất cả log
#   GET /api/system/audit-logs/{id}/   → chi tiết 1 log theo id
router.register('audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = router.urls
