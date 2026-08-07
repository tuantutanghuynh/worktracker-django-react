# 02 — `HasPermission`: DRF Permission class

## Cách 1 View "khai báo" nó cần permission gì

Mỗi View tự khai báo qua 1 class attribute, `HasPermission` đọc lại
attribute đó:

```python
class SomeView(APIView):
    required_permission = "client:create"   # View tự khai báo cần quyền gì
    permission_classes = [HasPermission]
```

## Code cuối cùng — `backend/accounts/permissions.py`

```python
from rest_framework.permissions import BasePermission
from .models import RolePermission


class HasPermission(BasePermission):
    def has_permission(self, request, view):
        required_code = getattr(view, "required_permission", None)

        if required_code is None:
            raise AssertionError(
                f"{view.__class__.__name__} is missing a 'required_permission' "
                "attribute. Set it to the permission code this view requires"
                "(e.g. 'client:create')."
            )

        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.role is None:
            return False

        return RolePermission.objects.filter(
            role=request.user.role, permission__code=required_code
        ).exists()
```

## Vì sao `raise AssertionError` nếu View quên khai báo `required_permission`

Đây là **lớp lỗi thứ 3** đã gặp xuyên suốt dự án (cùng họ với `RuntimeError`
trong `LoginSerializer.get_tokens()` ở Giai đoạn 1) — lỗi do **lập trình
viên dùng sai API**, không phải lỗi của user nhập sai dữ liệu. Nếu không có
guard clause này, `getattr(view, "required_permission", None)` trả về
`None`, và tùy cách viết code tiếp theo, có thể dẫn tới 1 trong 2 hậu quả
nguy hiểm:

- Nếu lỡ tay code thành `if required_code: ...` (chỉ check truthy) → quên
  khai báo permission đồng nghĩa với **luôn được phép** — lỗ hổng bảo mật
  nghiêm trọng.
- Nếu code thành so sánh `None` với permission thật → **luôn bị chặn** —
  bug khó debug vì không có thông báo rõ ràng "tại sao bị chặn".

`raise AssertionError` ngay khi phát hiện thiếu khai báo giúp lỗi này lộ ra
**ngay lúc dev/test đầu tiên**, với message chỉ rõ chính xác cần sửa gì —
không để nó trở thành 1 trong 2 hậu quả âm thầm ở trên.

## Vì sao tự check `request.user.is_authenticated`, dù đã có `IsAuthenticated` default toàn cục

`DEFAULT_PERMISSION_CLASSES` ở `settings.py` đảm bảo mặc định mọi View cần
đăng nhập — nhưng nếu 1 View khai báo `permission_classes = [HasPermission]`
(ghi đè hẳn default, không kèm `IsAuthenticated`), class này vẫn phải tự
đứng vững một mình, không dựa vào giả định "chắc đã có gì đó check đăng
nhập trước rồi". Đây là tinh thần "không tin tưởng lớp khác đã làm đúng
phần của nó" — cùng nguyên tắc với Data Isolation ("không tin Frontend") đã
học, áp dụng giữa các lớp Backend với nhau.

## Vì sao dùng `.exists()`, không lấy hết permission rồi check bằng Python

```python
RolePermission.objects.filter(...).exists()   # 1 câu SQL EXISTS, dừng ngay khi tìm thấy
```

so với kéo hết dữ liệu về Python rồi mới lọc — `.exists()` dịch thành câu
SQL `EXISTS(...)`, dừng tra cứu ngay khi tìm thấy 1 dòng khớp. Permission
check chạy ở **mọi request**, nên hiệu năng từng câu query nhỏ cũng đáng
để tối ưu đúng cách ngay từ đầu.

## Bug nhỏ đã gặp (không ảnh hưởng chức năng)

```python
raise AssertionError(
    f"{view.__class__.__name__} is missing a 'required_permission' "
    "attribute. Set it to the permission code this view requires"   # thiếu khoảng trắng cuối
    "(e.g. 'client:create')."   # đã sửa thiếu dấu nháy đóng ở bản đầu
)
```

Message in ra sẽ dính liền chữ `requires(e.g....` — chỉ ảnh hưởng độ rõ
ràng của message lúc dev, không ảnh hưởng logic. Sửa khi rảnh, không khẩn
cấp.

## Lỗi đường dẫn file đã gặp (đáng nói nhiều hơn lỗi code)

Lần đầu tạo file, `permissions.py` bị tạo ở `backend/permissions.py` (sai
vị trí) thay vì `backend/accounts/permissions.py`. Vì `from .models import
RolePermission` là **relative import** (tìm `models.py` cùng thư mục với
file hiện tại), đặt sai thư mục khiến Python tìm nhầm `backend/models.py`
(không tồn tại) — Pylance báo `Import ".models" could not be resolved`
ngay trong editor, trước khi cả chạy thử. Quy ước cần nhớ: mọi file
`serializers.py`, `views.py`, `urls.py`, `authentication.py`, `permissions.py`
của 1 app đều nằm **trong** thư mục app đó (`accounts/`), ngang hàng với
`models.py`.
