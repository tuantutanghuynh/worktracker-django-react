from rest_framework.routers import DefaultRouter

from projects.manager.views_manager import ManagerJobViewSet, ManagerClientViewSet


router = DefaultRouter()

router.register(
    r"jobs",
    ManagerJobViewSet,
    basename="manager-jobs",
)
router.register(
    r"clients",
    ManagerClientViewSet,
    basename="manager-clients",
)

urlpatterns = router.urls