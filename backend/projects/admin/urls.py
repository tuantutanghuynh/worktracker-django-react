from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, JobViewSet

router = DefaultRouter()
router.register('clients', ClientViewSet, basename='client')
router.register('jobs', JobViewSet, basename='job')

urlpatterns = router.urls
