from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, JobViewSet

# DefaultRouter tự động tạo các URL pattern từ ViewSet đã đăng ký.
# Không cần viết tay từng path() cho list/detail/create/update/delete.
router = DefaultRouter()

# Đăng ký ClientViewSet với prefix 'clients'.
# basename='client': tên gốc để đặt tên URL (vd: client-list, client-detail).
# → Tạo ra: GET/POST /api/projects/clients/
#           GET/PUT/PATCH/DELETE /api/projects/clients/{id}/
router.register('clients', ClientViewSet, basename='client')

# Đăng ký JobViewSet với prefix 'jobs'.
# → Tạo ra: GET/POST /api/projects/jobs/
#           GET/PUT/PATCH/DELETE /api/projects/jobs/{id}/
router.register('jobs', JobViewSet, basename='job')

urlpatterns = router.urls
