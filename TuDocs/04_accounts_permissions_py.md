# Executive Code Annotation: `backend/accounts/permissions.py`

**Package / Module:** `backend.accounts.permissions` · Fine-grained RBAC Permission Class

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Quy Trình Kiểm Tra Quyền (RBAC Permission Verification Workflow)

```
                       ┌──────────────────────────────────────┐
                       │  HTTP Request + Authenticated User   │
                       └──────────────────┬───────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │       HasPermission.has_permission() │
                       └──────────────────┬───────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │ Lấy required_code từ View/Instantiation      │
                  └───────────────────────┬───────────────────────┘
                                          │
                                   Is Auth Check?
                                ┌─────────┴─────────┐
                             NO │                   │ YES
                                ▼                   ▼
                        [Return False (401)]   Check must_change_password?
                                                    ┌───────┴───────┐
                                               YES  │               │ NO
                                                    ▼               ▼
                                            [PermissionDenied]  Check User Role?
                                                (403 Forbidden)     ┌───┴───┐
                                                                NO  │       │ YES
                                                                    ▼       ▼
                                                             [Return False] Check RolePermission DB?
                                                                                ┌───┴───┐
                                                                            NO  │       │ YES
                                                                                ▼       ▼
                                                                        [Return False] [RETURN TRUE (200)]
```

> **Vì sao chặn ngay request bằng `PermissionDenied` nếu `must_change_password = True`?**
> Đây là chốt chặn bảo mật quan trọng: Khi một nhân viên mới được cấp tài khoản (hoặc vừa được Admin reset mật khẩu), mật khẩu của họ đang ở trạng thái mặc định/tạm thời. Hệ thống bắt buộc người dùng này **phải đổi mật khẩu ngay lập tức** tại API Change Password trước khi được phép gọi bất kỳ API nghiệp vụ nào khác (xem dự án, bấm giờ chấm công...), ngăn ngừa rủi ro tài khoản bị chiếm đoạt.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Thư Viện Quyền của DRF

```python
from rest_framework.permissions import BasePermission
# "BasePermission": Class cơ sở trong Django REST Framework dùng để định nghĩa các bộ quy tắc phân quyền (Custom Permission).

from rest_framework.exceptions import PermissionDenied
# "PermissionDenied": Ngoại lệ (Exception) trả về lỗi HTTP 403 Forbidden kèm thông điệp giải thích lý do bị từ chối.
```

---

### 2. Khởi Tạo Class Phân Quyền Tùy Biến `HasPermission`

```python
class HasPermission(BasePermission):
# Khởi tạo class `HasPermission` kế thừa từ `BasePermission`.
# Class này hỗ trợ 2 cách dùng linh hoạt (Pattern 1 & Pattern 2):
# Pattern 1 (ViewSet): `permission_classes = [HasPermission('task:create')]`
# Pattern 2 (APIView): Khai báo `required_permission = 'task:create'` ngay trên class View.

    def __init__(self, required_permission=None):
        self.required_permission = required_permission
        # Hàm khởi tạo `__init__` cho phép truyền trực tiếp mã quyền (VD: `'timesheet:approve'`) khi khởi tạo class.

    def has_permission(self, request, view):
    # Hàm `has_permission` được DRF tự động gọi trước khi thực thi mã nguồn bên trong View. Trả về True (cho qua) hoặc False (chặn lại).

        required_code = self.required_permission or getattr(view, 'required_permission', None)
        # "getattr(view, 'required_permission', None)": Tìm xem trên View có khai báo thuộc tính `required_permission` hay không.
        # Ưu tiên mã quyền truyền từ `__init__`, nếu không có thì lấy mã quyền khai báo trên View.

        if required_code is None:
            raise AssertionError(
                f"{view.__class__.__name__} must set 'required_permission' as a class attribute "
                "or return HasPermission('code') from get_permissions()."
            )
            # Nếu lập trình viên quên không khai báo mã quyền ở cả 2 nơi, quăng lỗi lập trình `AssertionError` ngay lập tức để cảnh báo Dev.

        if not request.user or not request.user.is_authenticated:
            return False
            # BƯỚC 1: Nếu người dùng chưa đăng nhập (`is_authenticated = False`), từ chối ngay lập tức (Trả về False -> HTTP 401 Unauthorized).

        # must_change_password: dùng getattr để an toàn khi field chưa migrate
        if getattr(request.user, 'must_change_password', False):
            raise PermissionDenied("You must change your password before performing this action.")
            # BƯỚC 2: Nếu tài khoản đang bị cờ `must_change_password = True`, quăng lỗi `PermissionDenied` (HTTP 403 Forbidden)
            # kèm thông báo: "Bạn phải đổi mật khẩu trước khi thực hiện hành động này."

        if request.user.role is None:
            return False
            # BƯỚC 3: Nếu User chưa được gán Vai trò (`role = None`), từ chối truy cập.

        return request.user.role.role_permissions.filter(
            permission__code=required_code
        ).exists()
        # BƯỚC 4: Truy vấn CSDL bảng `role_permissions` xem Role của user hiện tại có sở hữu Mã quyền (`required_code`) này không.
        # Hàm `.exists()` trả về True nếu tìm thấy ít nhất 1 dòng khớp, ngược lại trả về False.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Cấp Độ Kiểm Tra | Điều Kiện Lập Trình | Phản Hồi Khi Thất Bại | Mục Đích Nghiệp Vụ |
|-------------------|------------------------|------------------------|-----------------------------|
| **Cấu hình Code** | `required_code is None` | `AssertionError` (Dev bug) | Ép lập trình viên phải chỉ định rõ mã quyền khi tạo API mới |
| **Xác thực Đăng nhập** | `not request.user.is_authenticated` | HTTP 401 Unauthorized | Chặn người lạ chưa đăng nhập truy cập API |
| **Bảo mật Mật khẩu** | `must_change_password == True` | HTTP 403 Forbidden ("You must change...") | Bắt buộc đổi mật khẩu tạm thời trước khi dùng app |
| **Gán Vai Trò** | `request.user.role is None` | HTTP 403 Forbidden | Chặn user "bơ vơ" chưa được Admin xếp vào vai trò nào |
| **Phân Quyền Chi Tiết** | `role_permissions.filter(...).exists()` | HTTP 403 Forbidden | So khớp mã quyền chi tiết (`task:create`, `report:export`) theo vai trò RBAC |
