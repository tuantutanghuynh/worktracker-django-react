# 02 — `LoginSerializer`: Validate thông tin đăng nhập & sinh Token

## Vì sao không kế thừa `TokenObtainPairSerializer` có sẵn của SimpleJWT

Cách phổ biến nhất khi tìm "Django JWT login" trên mạng là kế thừa
`TokenObtainPairSerializer`. Nhưng class đó dùng `authenticate()` của
Django — hàm này **gộp chung 2 việc**: kiểm tra password đúng/sai VÀ kiểm
tra `is_active`, rồi trả về `None` cho cả 2 trường hợp, không phân biệt
được. Theo đúng thiết kế ở `auth-guide/03-login-logout-flow.md` (401 cho
sai thông tin, 403 cho tài khoản bị khóa — 2 lỗi khác bản chất, cần 2 thông
báo khác nhau cho Frontend), cần tự kiểm tra 2 điều kiện riêng biệt. Vì vậy
viết `LoginSerializer` kế thừa `serializers.Serializer` thuần.

## Vì sao tránh `try/except` ở đây — chọn cấu trúc code không cần ném exception

Cách viết DRF "idiomatic" thường tránh try/except khi có thể tránh được,
bằng cách chọn API không ném exception cho trường hợp bình thường:

```python
# Sẽ cần try/except (KHÔNG dùng cách này):
user = User.objects.get(email=email)   # ném DoesNotExist nếu không thấy

# Không cần try/except (cách đã chọn):
user = User.objects.filter(email=email).first()   # trả về None, xử lý bằng if
```

`.filter().first()` trả về `None` an toàn — xử lý bằng `if` thông thường.
Nguyên tắc: "tìm không thấy" theo logic nghiệp vụ bình thường nên dùng
`if/else`, không phải lúc nào cũng cần exception — giống cách phân loại lỗi
bên Java (`IllegalArgumentException` chỉ dành cho input thật sự sai, không
dùng cho mọi nhánh logic).

## Code cuối cùng — `backend/accounts/serializers_auth.py`

```python
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    """Not based on TokenObtainPairSerializer: that class's authenticate()
    bundles wrong-credentials and inactive-account into a single error, but
    we need to tell them apart (401 vs 403)."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Declared upfront so the attribute always exists, even if
        # get_tokens() is ever called before validate() succeeds
        self.user = None

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = User.objects.filter(email=email).first()

        # Same message for "email not found" and "wrong password" so we
        # don't leak which emails exist in the system (anti user-enumeration)
        if user is None or not user.check_password(password):
            raise AuthenticationFailed("Invalid email or password.")

        # Kept separate: this is not a bad-input error, it's an
        # administrative block — frontend needs to show a different message
        if not user.is_active:
            raise PermissionDenied("User account is disabled. Please contact the administrator.")

        self.user = user
        return attrs

    def get_tokens(self):
        # Guard clause: fail fast with a clear reason if called out of
        # order, instead of letting Python raise a vague AttributeError below
        if self.user is None:
            raise RuntimeError(
                "get_tokens() called before successful validation. Ensure that validate() is called and passed before calling this method."
            )

        refresh = RefreshToken.for_user(self.user)

        # Custom claims must be set BEFORE reading access_token, since
        # access_token only copies claims already present on refresh at
        # the moment it's created
        refresh["email"] = self.user.email
        refresh["role"] = self.user.role.code if self.user.role else None

        access = refresh.access_token

        return {
            "access": str(access),
            "refresh": str(refresh),
            # Returned alongside the tokens so the frontend can render
            # immediately without decoding the JWT itself
            "user": {
                "id": self.user.id,
                "email": self.user.email,
                "role": self.user.role.code if self.user.role else None,
            },
        }
```

## Vì sao `AuthenticationFailed` → 401, `PermissionDenied` → 403 (không tự viết status code)

DRF có quy ước: mỗi exception class tự động map ra 1 HTTP status code khi
`raise` trong `validate()`:

| Exception | HTTP status tự động |
|---|---|
| `AuthenticationFailed` | 401 |
| `PermissionDenied` | 403 |

Không cần tự viết `return Response(..., status=401)` — DRF tự xử lý khi
exception bay lên tới View (chi tiết ở file 03).

## Bug thật đã phát hiện qua code review: `AttributeError` nếu gọi sai thứ tự

Một người review code đã chỉ ra: nếu `get_tokens()` bị gọi **trước khi**
`validate()` chạy thành công (ví dụ lập trình viên khác quên gọi
`is_valid()`), dòng `self.user` chưa từng được tạo ra trong object — Python
ném `AttributeError: 'LoginSerializer' object has no attribute 'user'`.

### Vì sao bug này là đặc thù của Python, không xảy ra ở Java

Java: field luôn tồn tại (mặc định `null`) ngay khi object được tạo, dù có
gán giá trị hay chưa. Python: field **chỉ tồn tại sau khi có dòng gán đầu
tiên chạy**. Đây là lớp lỗi runtime riêng của Python mà Java compiler không
bao giờ cho người viết Java gặp phải.

### Cách sửa — 2 thay đổi

1. Thêm `__init__` khai báo `self.user = None` ngay từ đầu — đảm bảo
   attribute **luôn tồn tại**, kể cả khi `validate()` chưa từng chạy.
2. Thêm **guard clause** đầu `get_tokens()` — kiểm tra `self.user is None`
   và `raise RuntimeError` với message rõ nguyên nhân, thay vì để Python tự
   ném `AttributeError` mơ hồ.

### Vì sao chọn `RuntimeError`, không phải `ValueError` hay tự tạo exception riêng

`ValueError` đúng ngữ nghĩa hơn cho "giá trị input sai" — nhưng vấn đề ở
đây không phải giá trị, mà là **trạng thái/thứ tự gọi hàm sai**.
`RuntimeError` là lựa chọn chuẩn Python cho tình huống "đối tượng đang ở
trạng thái không hợp lệ để thực hiện hành động bạn vừa gọi". Đây là **lớp
lỗi thứ 3** trong serializer này (khác với 2 lớp lỗi cho người dùng cuối ở
trên) — lỗi của **lập trình viên dùng sai API**, không phải lỗi của user
nhập sai dữ liệu.

## Sơ đồ luồng gọi 2 hàm (ai gọi, lúc nào) — tóm tắt bằng pseudocode

```text
View nhận request POST /login/
    ↓
serializer = LoginSerializer(data=request.data)
    ↓
serializer.is_valid(raise_exception=True)
    ↓ (DRF tự gọi validate() bên trong)
    validate(): đúng thông tin  → lưu self.user, không lỗi
               sai thông tin   → raise lỗi, DỪNG LUÔN, get_tokens()
                                  KHÔNG BAO GIỜ được gọi tới trong luồng đúng
    ↓ (chỉ tới đây nếu validate() không raise lỗi)
tokens = serializer.get_tokens()
    ↓
trả tokens về Frontend
```

Trong luồng đúng (qua View), `get_tokens()` không bao giờ bị gọi khi `user`
còn `None` — guard clause chỉ là **lưới an toàn cho trường hợp dùng sai**
(test viết sai thứ tự, code sau này lỡ sửa nhầm). Đây là tinh thần "double
protection" giống `CheckConstraint` ở tầng DB đã học ở `timesheet-guide` —
lớp chính (View dùng đúng) + lớp phòng hộ (guard clause) độc lập với nhau.
