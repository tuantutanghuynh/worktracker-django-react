# timesheets/urls_manager.py
from rest_framework.routers import DefaultRouter
from timesheets.views_manager import TimeLockViewSet

router = DefaultRouter()
router.register(r'time-locks', TimeLockViewSet, basename='manager-timelocks')

urlpatterns = router.urls