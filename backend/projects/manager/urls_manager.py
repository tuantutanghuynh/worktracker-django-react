"""
Module: projects.manager.urls_manager
Description: URL routing configuration for manager-scoped project job and client endpoints.
"""

from rest_framework.routers import DefaultRouter
from projects.manager.views_manager import ManagerJobViewSet, ManagerClientViewSet

router = DefaultRouter()

# Manager-scoped job router
router.register(
    r"jobs",
    ManagerJobViewSet,
    basename="manager-jobs",
)

# Manager client catalog router
router.register(
    r"clients",
    ManagerClientViewSet,
    basename="manager-clients",
)

urlpatterns = router.urls