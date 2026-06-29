# system/permissions.py
from rest_framework import permissions

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
    FR-31, FR-99: Đảm bảo Manager chỉ có thể thao tác trên các Job/Task do chính họ quản lý.
    """
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'manager'):  # Nếu đối tượng là Job
            return obj.manager == request.user
        if hasattr(obj, 'job'):      # Nếu đối tượng là Task hoặc LogWork
            return obj.job.manager == request.user
        return False