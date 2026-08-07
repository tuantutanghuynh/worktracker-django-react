# 03 — Chặn `must_change_password` trong `HasPermission`

## Vì sao đặt ở tầng Permission, không đặt ở tầng Authentication

Đã có tiền lệ: `is_active=False` được chặn ngay ở tầng **Authentication**
(`BlacklistAwareJWTAuthentication`/SimpleJWT tự check) — phát hiện ở Giai
đoạn 3 testing, tài khoản bị khóa nhận 401 trước cả khi tới bước kiểm tra
Permission. Vậy sao `must_change_password` lại không làm tương tự?

Lý do: **Permission nhận được tham số `view`**, còn Authentication thì
không (`get_validated_token(self, raw_token)` không biết view nào đang xử
lý request). Vì cần **1 view (`ChangePasswordView`) tự "miễn trừ" chính
nó** khỏi luật chặn (để user còn cách thoát ra), phải đặt ở tầng có thể
phân biệt theo view — đó là Permission, không phải Authentication.

## Cách "miễn trừ" diễn ra tự nhiên, không cần danh sách ngoại lệ viết tay

`ChangePasswordView` dùng `permission_classes = [IsAuthenticated]` (không
dùng `HasPermission`) — xem `02-change-password-view.md`. Vì luật chặn
chỉ được viết **bên trong** `HasPermission.has_permission()`, bất kỳ view
nào không dùng `HasPermission` (chỉ `LoginView`, `LogoutView`,
`ForgotPasswordView`, `ResetPasswordView`, `ChangePasswordView` — toàn bộ
nhóm "auth dùng chung") đều tự động không bị ảnh hưởng — **không cần if
loại trừ theo tên view**, đơn giản vì luật đó không chạy qua những view
này.

## Code cuối cùng — `backend/accounts/permissions.py`

```python
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied
from .models import RolePermission


class HasPermission(BasePermission):
    def has_permission(self, request, view):
        required_code = getattr(view, "required_permission", None)

        if required_code is None:
            raise AssertionError(
                f"{view.__class__.__name__} is missing a 'required_permission' "
                "attribute. Set it to the permission code this view requires "
                "(e.g. 'client:create')."
            )

        if not request.user or not request.user.is_authenticated:
            return False

        # Force the password-change flow to finish before any other
        # role-gated action. ChangePasswordView uses plain IsAuthenticated
        # (not this class), so it is never blocked by this check itself.
        if request.user.must_change_password:
            raise PermissionDenied("You must change your password before performing this action.")

        if request.user.role is None:
            return False

        return RolePermission.objects.filter(
            role=request.user.role, permission__code=required_code
        ).exists()
```

## Vì sao đặt ngay sau check `is_authenticated`, trước khi check `role`

`must_change_password` là thuộc tính của **người dùng đã xác thực** —
kiểm tra nó trước khi biết user là ai là vô nghĩa, nên đặt sau
`is_authenticated`. Đặt **trước** bước tra `RolePermission` vì đây là
điều kiện chặn cấp cao hơn — không cần tốn 1 câu query DB nếu đằng nào
cũng bị chặn vì lý do khác trước đó.

## Vì sao `raise PermissionDenied(...)` với message riêng, không chỉ `return False`

Nếu chỉ `return False`, DRF tự trả message chung *"You do not have
permission to perform this action."* — Frontend (Minh Anh/Đức Long, khi
họ viết view dùng `HasPermission` của riêng mình) sẽ không phân biệt được
"bị chặn vì thiếu quyền role" và "bị chặn vì chưa đổi password" — 2 việc
cần xử lý UI khác nhau hoàn toàn (1 cái hiện trang "không có quyền", 1
cái phải redirect sang `/change-password`). `raise` với message riêng cho
phép Frontend đọc `response.data.detail` để rẽ nhánh đúng.

## Hệ quả thực tế: luật này áp dụng cho TẤT CẢ view dùng `HasPermission`, không chỉ của Tuấn Tú

Vì đặt code chặn ngay trong class `HasPermission` (không phải lặp lại ở
từng view), **mọi view Minh Anh/Đức Long viết sau này** (miễn họ dùng
đúng `HasPermission` theo quy ước chung) cũng tự động được bảo vệ —
không ai trong nhóm cần tự nhớ thêm điều kiện này vào view của mình.
