"""
Module: accounts.admin.urls
Description: Router registrations for administrative user, role, and department REST endpoints.
"""

from rest_framework.routers import DefaultRouter
from .views import UserViewSet, RoleViewSet, DepartmentViewSet

router = DefaultRouter()

# User accounts endpoint router
router.register('users', UserViewSet, basename='user')

# Role catalog lookup endpoint router
router.register('roles', RoleViewSet, basename='role')

# Department management endpoint router
router.register('departments', DepartmentViewSet, basename='department')

urlpatterns = router.urls
