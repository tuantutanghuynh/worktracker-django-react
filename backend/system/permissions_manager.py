# system/permissions_manager.py
from rest_framework import permissions
from projects.models import Job
from tasks.models import Task
from timesheets.models import LogWork

class IsManager(permissions.BasePermission):
    """
    BR-05: Kiểm tra người dùng đăng nhập có vai trò MANAGER và tài khoản đang hoạt động.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_active and 
            request.user.role and 
            request.user.role.code == 'MANAGER'
        )

class IsJobManager(permissions.BasePermission):
    """
    FR-31, FR-99, FR-117: Row-level scope — Manager chỉ thao tác trên Job/Task/LogWork
    thuộc job mà chính họ là jobs.manager_id. KHÔNG dùng departments.manager_id.
    """
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Job):
            return obj.manager_id == request.user.id
        if isinstance(obj, Task):
            return obj.job.manager_id == request.user.id
        if isinstance(obj, LogWork):
            return obj.task.job.manager_id == request.user.id
        return False