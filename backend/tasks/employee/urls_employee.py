from rest_framework.routers import DefaultRouter
from .views_employee import EmployeeTaskViewSet

router = DefaultRouter()
router.register(r"tasks", EmployeeTaskViewSet, basename="employee-tasks")

urlpatterns = router.urls
