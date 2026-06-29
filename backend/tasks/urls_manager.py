# tasks/urls.py
from tasks.views_manager import TaskViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='manager-tasks')

urlpatterns = router.urls