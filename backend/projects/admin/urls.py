from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, JobViewSet

router = DefaultRouter()

# ── CLIENTS ───────────────────────────────────────────────────────────────────
# GET    /api/admin/clients/        → Danh sách client (filter: ?name=, ?is_active=)
# POST   /api/admin/clients/        → Tạo client mới (quyền: client:create) + ghi audit
# GET    /api/admin/clients/{id}/   → Chi tiết 1 client
# PUT    /api/admin/clients/{id}/   → Cập nhật toàn bộ (quyền: client:update) + ghi audit
# PATCH  /api/admin/clients/{id}/   → Cập nhật một phần (quyền: client:update) + ghi audit
# DELETE /api/admin/clients/{id}/   → Xóa mềm: is_active=False, vẫn còn trong DB + ghi audit
router.register('clients', ClientViewSet, basename='client')

# ── JOBS ──────────────────────────────────────────────────────────────────────
# GET    /api/admin/jobs/           → Danh sách job
# POST   /api/admin/jobs/           → Tạo job mới (quyền: job:create) + ghi audit
# GET    /api/admin/jobs/{id}/      → Chi tiết 1 job
# PUT    /api/admin/jobs/{id}/      → Cập nhật job, validate state machine (quyền: job:update) + ghi audit
# PATCH  /api/admin/jobs/{id}/      → Cập nhật một phần job (quyền: job:update) + ghi audit
# DELETE /api/admin/jobs/{id}/      → Xóa mềm: status='CANCELLED', vẫn còn trong DB + ghi audit
router.register('jobs', JobViewSet, basename='job')

urlpatterns = router.urls
