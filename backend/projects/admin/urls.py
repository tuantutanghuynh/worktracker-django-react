"""
Module: projects.admin.urls
Description: Router registrations for administrative client and job endpoints.
"""

from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, JobViewSet

router = DefaultRouter()

# Client management REST endpoint router
router.register('clients', ClientViewSet, basename='client')

# Job management REST endpoint router
router.register('jobs', JobViewSet, basename='job')

urlpatterns = router.urls
