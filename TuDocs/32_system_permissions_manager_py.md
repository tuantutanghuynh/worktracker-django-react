# Executive Code Annotation: `backend/system/permissions_manager.py`

**Package / Module:** `backend.system.permissions_manager` · Manager & Action Level Permissions

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (chìa khóa, thẻ bảo vệ, danh sách trắng, hàng rào kiểm soát...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiểm Soát Quyền Truy Cập (Permissions Manager Relational Diagram)

```
 HTTP Request từ Client (Manager / Admin / Employee)
                       │
                       ▼
 ┌───────────────────────────────────────────────────────────┐
 │               Lớp Đệm Kiểm Tra Đầu Vào (DRF)               │
 └─────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
 ┌───────────────────────────────────────────────────────────┐
 │                  IsActiveAuthenticated                    │  ── (User đã đăng nhập & account active?)
 └─────────────────────┬─────────────────────────────────────┘
                       │ Valid
                       ▼
 ┌───────────────────────────────────────────────────────────┐
 │         IsManagerRole / IsAdminOrManagerRole              │  ── (User thuộc Vai trò Quản lý / Admin?)
 └─────────────────────┬─────────────────────────────────────┘
                       │ Valid
                       ▼
 ┌───────────────────────────────────────────────────────────┐
 │                   HasPermissionCode                       │  ── (User có mã quyền action cụ thể?)
 └─────────────────────┬─────────────────────────────────────┘
                       │
             ┌─────────┴─────────┐
             │ Tra cứu Redis Cache│
             │ key: role_perm... │
             └────┬──────────┬───┘
       Hit (Có)   │          │  Miss (Không)
                  │          ▼
                  │   Query Bảng DB
                  │   RolePermission
                  │          │  Cache set (300s)
                  └──────────┼───────────────┐
                             ▼               ▼
                      [ ALLOW (200) ]  [ DENY (403) ]
```

> **Vì sao lại cache danh sách `permission_codes` theo `role_id` trong 300 giây (5 phút)?**
> Trong mọi request gửi tới các API bảo mật của WorkTracker, hệ thống phải kiểm tra xem vai trò (Role) của người dùng hiện tại có chứa mã quyền (Permission Code) yêu cầu hay không. Nếu mỗi request đều truy vấn xuống cơ sở dữ liệu để `JOIN` bảng `RolePermission` và `Permission`, DB sẽ bị quá tải (bị bottleneck). Việc lưu danh sách mã quyền vào Redis Cache trong 5 phút giúp đưa thời gian phản hồi kiểm tra quyền từ ~15-30ms xuống <1ms, đảm bảo tiêu chí NFR-04 về hiệu năng.

> **Vì sao class `HasPermissionCode` từ chối (Deny - return `False`) nếu View không khai báo `required_permission`?**
> Đây là triết lý thiết kế **"Fail-Safe Defaults"** (An toàn mặc định). Nếu một lập trình viên vô tình đính kèm `HasPermissionCode` vào một View nhưng lại quên khai báo thuộc tính `required_permission`, hệ thống sẽ chặn toàn bộ truy cập thay vì thả cho phép qua. Việc này ngăn ngừa triệt để nguy cơ lộ hổng bảo mật do sơ suất của con người.

> **Vì sao tách biệt thành 2 tầng kiểm tra: `IsManagerRole` (Tầng Vai trò) và `HasPermissionCode` (Tầng Mã quyền)?**
> - **Tầng Vai trò (`IsManagerRole`):** Kiểm tra diện rộng (Coarse-grained) dựa trên chức danh cao cấp (VD: Người này có phải là Trưởng phòng/Manager không?).
> - **Tầng Mã quyền (`HasPermissionCode`):** Kiểm tra hành vi chi tiết (Fine-grained) theo ma trận RBAC (VD: Manager này có quyền duyệt công `TASK_APPROVE` hay không?).
> Việc phân tầng này giúp hệ thống linh hoạt khi cần tùy biến phân quyền riêng cho từng phòng ban mà không phải viết lại logic điều hướng.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Khai Báo Thư Viện & Các Hằng Số Cấu Hình Cache

```python
from django.core.cache import cache
# "from django.core.cache import cache" = mượn đối tượng `cache` mặc định từ hệ thống Django Cache Framework.
# Đối tượng này kết nối trực tiếp tới Redis (hoặc Memory cache) để đọc/ghi dữ liệu tạm thời.

from rest_framework.permissions import BasePermission
# "from rest_framework.permissions import BasePermission" = mượn lớp cơ sở `BasePermission` từ Django REST Framework.
# Mọi class kiểm tra quyền tự định nghĩa đều phải kế thừa từ `BasePermission` và ghi đè hàm `has_permission`.

from accounts.models import RolePermission
# "from accounts.models import RolePermission" = nạp model trung gian `RolePermission` kết nối giữa Vai trò (Role) và Quyền hạn (Permission).


MANAGER_ROLE_CODE = "MANAGER"
# Hằng số định danh chuỗi vai trò Quản lý / Trưởng phòng trong hệ thống.

ADMIN_ROLE_CODE = "ADMIN"
# Hằng số định danh chuỗi vai trò Quản trị viên tối cao.

ROLE_PERMISSION_CACHE_KEY = "role_permissions:{role_id}"
# "ROLE_PERMISSION_CACHE_KEY" = Mẫu chuỗi định dạng key cho Cache.
# Dấu cú pháp `{role_id}` đóng vai trò làm giữ chỗ (placeholder) để nhét ID của Role vào khi format chuỗi.

ROLE_PERMISSION_CACHE_TIMEOUT = 300  # 5 phút
# Thời gian sống (TTL - Time To Live) của cache quyền hạn tính bằng giây (300s = 5 phút).
```

---

### 2. Các Hàm Trợ Giúp Đọc Vai Trò & Mã Quyền Của User (`get_user_role_code` & `get_permission_codes_for_role`)

```python
def get_user_role_code(user):
    """
    Lấy role code an toàn.
    Trả về None nếu user chưa có role.
    """
    role = getattr(user, "role", None)
    # "getattr(user, 'role', None)" = truy cập an toàn thuộc tính `role` của object `user`.
    # Nếu đối tượng `user` không có thuộc tính `role` hoặc là `None`, trả về `None` chứ không ném lỗi `AttributeError`.

    return getattr(role, "code", None)
    # Tiếp tục lấy thuộc tính `code` từ đối tượng `role`. Trả về `None` nếu `role` là `None`.
    # Ví von: Kiểm tra xem nhân viên có đeo thẻ tên không, nếu có thẻ thì đọc mã chức danh ghi trên thẻ.


def get_permission_codes_for_role(role_id):
    """
    Lấy danh sách permission code của role.

    Có cache để giảm số lần query role_permissions.
    Khi Admin cập nhật permission cho role, phía Admin nên xóa cache key này.
    """
    cache_key = ROLE_PERMISSION_CACHE_KEY.format(role_id=role_id)
    # "ROLE_PERMISSION_CACHE_KEY.format(role_id=role_id)" = điền `role_id` vào mẫu key cache.
    # Ví dụ: Nếu `role_id=2`, kết quả chuỗi thu được sẽ là `"role_permissions:2"`.

    cached_codes = cache.get(cache_key)
    # "cache.get(cache_key)" = thử đọc danh sách quyền từ bộ nhớ đệm Redis bằng key vừa tạo.

    if cached_codes is not None:
        return set(cached_codes)
    # "if cached_codes is not None:" = kiểm tra xem dữ liệu có sẵn trong cache không (Cache Hit).
    # "return set(cached_codes)" = chuyển đổi danh sách thành một Tập hợp (Set) để tối ưu tốc độ tìm kiếm `O(1)`.

    codes = list(
        RolePermission.objects.filter(role_id=role_id)
        .select_related("permission")
        .values_list("permission__code", flat=True)
    )
    # Nếu trật cache (Cache Miss):
    # - "RolePermission.objects.filter(role_id=role_id)" = lọc tất cả dòng liên kết quyền của `role_id` này.
    # - ".select_related('permission')" = tối ưu SQL query bằng cách `JOIN` ngay bảng `Permission` để lấy chi tiết.
    # - ".values_list('permission__code', flat=True)" = chỉ rút ra danh sách các chuỗi mã quyền (VD: `['TASK_VIEW', 'TASK_APPROVE']`),
    #   tham số `flat=True` giúp biến kết quả thành danh sách 1 chiều thay vì danh sách các tuple `[('TASK_VIEW',), ...]`.

    cache.set(cache_key, codes, ROLE_PERMISSION_CACHE_TIMEOUT)
    # "cache.set(...)" = ghi nhận danh sách mã quyền thu được vào Redis Cache với thời hạn 300 giây.

    return set(codes)
    # Trả về một Set chứa các mã quyền cho caller tiêu thụ.
```

---

### 3. Lớp Kiểm Tra Xác Thực Trạng Thái Tài Khoản (`IsActiveAuthenticated`)

```python
class IsActiveAuthenticated(BasePermission):
    """
    Yêu cầu:
    - User đã đăng nhập.
    - Tài khoản còn active.
    """

    message = "User is not authenticated or account is inactive."
    # Thông điệp phản hồi mặc định trả về cho Client khi bị từ chối truy cập (HTTP 403 Forbidden).

    def has_permission(self, request, view):
        # "has_permission(self, request, view)" = phương thức chuẩn của DRF gọi mỗi khi kiểm tra request vào view.

        user = getattr(request, "user", None)
        # Rút đối tượng người dùng từ `request.user`.

        return bool(
            user
            and user.is_authenticated
            and user.is_active
        )
        # "bool(...)" = ép kết quả kiểm tra về kiểu Boolean (`True` hoặc `False`).
        # Điều kiện cho phép truy cập:
        # 1. `user` tồn tại (không `None`).
        # 2. `user.is_authenticated` = đã qua trạm kiểm tra Token JWT thành công.
        # 3. `user.is_active` = tài khoản không bị khóa (Lock/Disable) bởi Admin.
```

---

### 4. Lớp Kiểm Tra Vai Trò Manager (`IsManagerRole`)

```python
class IsManagerRole(BasePermission):
    """
    Chỉ cho phép user có role MANAGER.
    """

    message = "Only Manager role is allowed."
    # Câu thông báo lỗi khi không phải Manager.

    def has_permission(self, request, view):
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return False
        # Nếu chưa đăng nhập hoặc không có user -> chặn ngay.

        return get_user_role_code(user) == MANAGER_ROLE_CODE
        # Lấy mã role của user và so sánh với hằng số `"MANAGER"`.
        # Trả về `True` nếu khớp, ngược lại trả về `False`.
```

---

### 5. Lớp Kiểm Tra Vai Trò Admin Hoặc Manager (`IsAdminOrManagerRole`)

```python
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
        # "in {ADMIN_ROLE_CODE, MANAGER_ROLE_CODE}" = kiểm tra xem mã role của user có nằm trong tập hợp vai trò cho phép hay không.
        # Cú pháp toán tử `in` kết hợp với cấu trúc Set `{...}` cho tốc độ truy vấn tức thì.
```

---

### 6. Lớp Kiểm Tra Mã Quyền Chi Tiết Tầng Hành Động (`HasPermissionCode`)

```python
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
        # Bảo vệ tầng 1: Bắt buộc user phải hợp lệ và active.

        role = getattr(user, "role", None)
        if role is None:
            return False
        # Bảo vệ tầng 2: User không được gán vai trò nào -> từ chối ngay.

        required_permission = getattr(view, "required_permission", None)
        # Lấy thuộc tính `required_permission` được khai báo trong View (ví dụ: `required_permission = 'JOB_CREATE'`).

        if not required_permission:
            return False
        # Bảo vệ tầng 3 (Fail-Safe): Nếu View quên khai báo `required_permission` -> chặn lại ngay lập tức!

        user_permission_codes = get_permission_codes_for_role(role.id)
        # Rút danh sách tập hợp các mã quyền mà vai trò này sở hữu (từ Redis Cache hoặc DB).

        if isinstance(required_permission, str):
            return required_permission in user_permission_codes
        # Trường hợp `required_permission` là 1 chuỗi đơn lẻ (VD: `"TASK_APPROVE"`):
        # Kiểm tra chuỗi đó có nằm trong tập hợp `user_permission_codes` không.

        if isinstance(required_permission, (list, tuple, set)):
            return any(
                code in user_permission_codes
                for code in required_permission
            )
        # Trường hợp `required_permission` là một danh sách/tập hợp (VD: `["TASK_APPROVE", "TASK_REJECT"]`):
        # "any(...)" = trả về `True` nếu user sở hữu ÍT NHẤT MỘT trong các mã quyền yêu cầu.

        return False
        # Nếu `required_permission` không đúng các kiểu dữ liệu trên -> mặc định chặn.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Thành phần Class / Hàm | Loại Kiểm Tra / Chức Năng | Cơ Chế Bảo Mật / Tối Ưu Hiệu Năng | Ý Nghĩa Nghiệp Vụ WorkTracker |
|------------------------|---------------------------|----------------------------------|--------------------------------|
| `get_user_role_code()` | Helper Function | An toàn với `getattr()`, tránh lỗi crash `AttributeError` | Lấy mã chức danh nhân viên (ADMIN, MANAGER, EMPLOYEE) |
| `get_permission_codes_for_role()` | Helper Function + Caching | Redis Cache key `role_permissions:{role_id}` (TTL 300s), `select_related` | Đọc danh sách mã quyền thao tác nhanh, giảm 95% tải DB |
| `IsActiveAuthenticated` | DRF Permission Class | Kiểm tra 3 điều kiện: User tồn tại + Authed + Active | Đảm bảo tài khoản bị khóa/cho nghỉ việc không thể gọi API |
| `IsManagerRole` | DRF Permission Class | Role-based Access Control (RBAC) tầng thô | Giới hạn API chỉ dành cho Trưởng phòng / Manager |
| `IsAdminOrManagerRole` | DRF Permission Class | Set Lookup `in {ADMIN, MANAGER}` | Dành cho các endpoint chung giữa Ban giám đốc & Trưởng phòng |
| `HasPermissionCode` | DRF Permission Class | Action-based Access Control (ABAC) tầng mịn, Fail-Safe Defaults | Kiểm tra quyền cụ thể (VD: Duyệt công, Sửa dự án). Chặn nếu View quên khai báo |
