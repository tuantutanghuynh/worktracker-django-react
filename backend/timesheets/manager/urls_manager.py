"""
Module: timesheets.manager.urls_manager
Description: URL route registrations for manager-scoped work log review and period locking.
"""

from rest_framework.routers import DefaultRouter
from timesheets.manager.views_manager import (
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