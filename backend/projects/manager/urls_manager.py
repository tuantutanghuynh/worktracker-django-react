from rest_framework.routers import DefaultRouter

from projects.manager.views_manager import ManagerJobViewSet


router = DefaultRouter()

router.register(
    r"jobs",
    ManagerJobViewSet,
    basename="manager-jobs",
)

urlpatterns = router.urls