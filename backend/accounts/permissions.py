# ┌─────────────────────────────────────────────────────────────────────┐
# │  SHARED FILE — MinhAnh · LongNguyen · TuanTu-3 đều import          │
# │                                                                      │
# │  MERGE RISK:                                                         │
# │  HasPermission được dùng ở MỌI ViewSet trong toàn hệ thống.        │
# │  - Không đổi cách khởi tạo: HasPermission('code') phải giữ nguyên  │
# │  - Không đổi tên class                                               │
# │  - Nếu Long/Tú thêm logic vào has_permission(), review kỹ trước     │
# │    khi merge — một thay đổi nhỏ sẽ ảnh hưởng toàn bộ RBAC          │
# └─────────────────────────────────────────────────────────────────────┘
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


class HasPermission(BasePermission):
    # Pattern 1 (ViewSet): get_permissions() returns [HasPermission('code')]
    # Pattern 2 (APIView): required_permission = 'code' on view + permission_classes = [HasPermission]
    def __init__(self, required_permission=None):
        self.required_permission = required_permission

    def has_permission(self, request, view):
        required_code = self.required_permission or getattr(view, 'required_permission', None)

        if required_code is None:
            raise AssertionError(
                f"{view.__class__.__name__} must set 'required_permission' as a class attribute "
                "or return HasPermission('code') from get_permissions()."
            )

        if not request.user or not request.user.is_authenticated:
            return False

        # must_change_password: dùng getattr để an toàn khi field chưa migrate
        if getattr(request.user, 'must_change_password', False):
            raise PermissionDenied("You must change your password before performing this action.")

        if request.user.role is None:
            return False

        return request.user.role.role_permissions.filter(
            permission__code=required_code
        ).exists()