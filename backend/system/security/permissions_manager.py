from django.core.cache import cache
from rest_framework.permissions import BasePermission

from accounts.models import RolePermission


MANAGER_ROLE_CODE = "MANAGER"
ADMIN_ROLE_CODE = "ADMIN"

ROLE_PERMISSION_CACHE_KEY = "role_permissions:{role_id}"
ROLE_PERMISSION_CACHE_TIMEOUT = 300  # 5 phút


def get_user_role_code(user):
    """
    Lấy role code an toàn.
    Trả về None nếu user chưa có role.
    """
    role = getattr(user, "role", None)
    return getattr(role, "code", None)


def get_permission_codes_for_role(role_id):
    """
    Lấy danh sách permission code của role.

    Có cache để giảm số lần query role_permissions.
    Khi Admin cập nhật permission cho role, phía Admin nên xóa cache key này.
    """
    cache_key = ROLE_PERMISSION_CACHE_KEY.format(role_id=role_id)
    cached_codes = cache.get(cache_key)

    if cached_codes is not None:
        return set(cached_codes)

    codes = list(
        RolePermission.objects.filter(role_id=role_id)
        .select_related("permission")
        .values_list("permission__code", flat=True)
    )

    cache.set(cache_key, codes, ROLE_PERMISSION_CACHE_TIMEOUT)
    return set(codes)


class IsActiveAuthenticated(BasePermission):
    """
    Yêu cầu:
    - User đã đăng nhập.
    - Tài khoản còn active.
    """

    message = "User is not authenticated or account is inactive."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)

        return bool(
            user
            and user.is_authenticated
            and user.is_active
        )


class IsManagerRole(BasePermission):
    """
    Chỉ cho phép user có role MANAGER.
    """

    message = "Only Manager role is allowed."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return False

        return get_user_role_code(user) == MANAGER_ROLE_CODE


class IsAdminOrManagerRole(BasePermission):
    """
    Dùng cho một số endpoint cho phép cả Admin và Manager.
    Giai đoạn Manager chủ yếu dùng IsManagerRole.
    """

    message = "Only Admin or Manager role is allowed."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return False

        return get_user_role_code(user) in {
            ADMIN_ROLE_CODE,
            MANAGER_ROLE_CODE,
        }


class HasPermissionCode(BasePermission):
    """
    Kiểm tra action-level permission theo RolePermission.

    View phải khai báo:
        required_permission = "TASK_APPROVE"

    Hoặc nếu một endpoint chấp nhận nhiều permission:
        required_permission = ["TASK_APPROVE", "TASK_REJECT"]

    Nếu view không khai báo required_permission thì deny.
    Cách này tránh lỗi quên khai báo permission nhưng endpoint vẫn mở.
    """

    message = "User does not have required permission."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated or not user.is_active:
            return False

        role = getattr(user, "role", None)
        if role is None:
            return False

        required_permission = getattr(view, "required_permission", None)

        if not required_permission:
            return False

        user_permission_codes = get_permission_codes_for_role(role.id)

        if isinstance(required_permission, str):
            return required_permission in user_permission_codes

        if isinstance(required_permission, (list, tuple, set)):
            return any(
                code in user_permission_codes
                for code in required_permission
            )

        return False