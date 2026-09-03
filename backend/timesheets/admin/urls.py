"""
Module: timesheets.admin.urls
Description: URL routing definitions for administration timesheet control and global time locks.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    AdminTimeLockViewSet,
    AdminTimesheetSummaryView,
    AdminTimesheetEmployeeListView,
    AdminTimesheetEmployeeDetailView,
    AdminTimesheetExportView,
)

router = DefaultRouter()
router.register('time-locks', AdminTimeLockViewSet, basename='admin-timelock')

urlpatterns = router.urls + [
    path('summary/', AdminTimesheetSummaryView.as_view(), name='admin-timesheet-summary'),
    path('employees/', AdminTimesheetEmployeeListView.as_view(), name='admin-timesheet-employees'),
    path('employees/export/', AdminTimesheetExportView.as_view(), name='admin-timesheet-export'),
    path('employees/<int:user_id>/', AdminTimesheetEmployeeDetailView.as_view(), name='admin-timesheet-employee-detail'),
]
