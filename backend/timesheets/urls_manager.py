from rest_framework.routers import DefaultRouter

from timesheets.views_manager import (
    ManagerLogWorkViewSet,
    ManagerTimeLockViewSet,
)


router = DefaultRouter()

router.register(
    r"log-works",
    ManagerLogWorkViewSet,
    basename="manager-log-works",
)

router.register(
    r"time-locks",
    ManagerTimeLockViewSet,
    basename="manager-time-locks",
)

urlpatterns = router.urls