# 03 — `BlacklistAwareJWTAuthentication`

Đây là bước biến blacklist từ "có ghi vào Redis" thành "có tác dụng thật"
— và là bước phát sinh nhiều bug nhất trong toàn bộ Giai đoạn 2.

## Vì sao override đúng `get_validated_token()`, không viết lại từ đầu

`JWTAuthentication` (của SimpleJWT) đã có sẵn toàn bộ logic khó: giải mã
token, verify chữ ký, kiểm tra hết hạn. `get_validated_token()` là method
chính xác nơi việc đó xảy ra và trả về token đã hợp lệ. Gọi
`super().get_validated_token()` trước, rồi chỉ thêm 1 bước kiểm tra mới
lên trên — tận dụng lại toàn bộ logic đúng đã có, không viết lại.

## Code cuối cùng — `backend/accounts/authentication.py`

```python
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .redis_client import redis_client


class BlacklistAwareJWTAuthentication(JWTAuthentication):

    def get_validated_token(self, raw_token):
        # Để class gốc làm hết việc khó: verify chữ ký, kiểm tra hết hạn
        validated_token = super().get_validated_token(raw_token)

        jti = validated_token["jti"]
        if redis_client.exists(f"blacklist:{jti}"):
            raise AuthenticationFailed("Token has been revoked.")

        return validated_token
```

Vì sao `raise AuthenticationFailed` (→ 401), không phải `PermissionDenied`
(→ 403): token bị blacklist nghĩa là "thông tin xác thực này không còn
được tin tưởng nữa" — cùng bản chất với "sai thông tin đăng nhập" ở
`LoginSerializer`, khác với 403 (đã biết bạn là ai, nhưng cấm hành động).

Vì sao dùng `redis_client.exists()`, không dùng `get()`: key trong Redis
chỉ mang tính chất cờ đánh dấu có/không tồn tại — giá trị `"1"` bên trong
không quan trọng.

## Cập nhật `settings.py`

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.BlacklistAwareJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}
```

## 3 bug thật đã gặp ở bước này

### Bug 1 — `validated_token["tji"]` (đảo 2 ký tự) → crash ngay, dễ phát hiện

```python
jti = validated_token["tji"]   # SAI
```

Claim trong JWT tên là `jti`, không phải `tji`. Token không có claim
`tji` nên `__getitem__` ném `KeyError('tji')` ngay khi gọi API — traceback
rõ ràng, dễ phát hiện.

### Bug 2 — `f"backlist:{jti}"` (thiếu chữ "k") → **âm thầm vô hiệu hóa toàn bộ Bước 3**

```python
if redis_client.exists(f"backlist:{jti}"):   # SAI: thiếu "k", phải là "blacklist"
```

Đây là bug nguy hiểm nhất trong toàn bộ Giai đoạn 2. `LogoutView` ghi key
vào Redis với tiền tố `blacklist:...` (đúng), còn class này lại tra cứu
với tiền tố `backlist:...` — 2 chuỗi không bao giờ khớp nhau,
`redis_client.exists()` **luôn luôn trả về `False`**, dù token đã logout
hay chưa. Hậu quả: toàn bộ Bước 3 không có tác dụng gì cả, nhưng **không
một dòng lỗi nào báo cho bạn biết** — nếu chỉ sửa Bug 1 mà không phát hiện
Bug 2, mọi request đều chạy trơn tru, rất dễ tưởng nhầm "đã xong".

Đây là lý do **chỉ test "không bị lỗi/không crash" là chưa đủ** — phải
test đúng kết quả mong đợi cụ thể (token đã logout phải bị 401, không chỉ
"API không crash"). Chỉ Integration Test thật (file 04) mới lộ ra được.

### Bug 3 — 2 key cùng tên trong dict `REST_FRAMEWORK` (ở `settings.py`)

Khi sửa lại `DEFAULT_AUTHENTICATION_CLASSES`, có lúc thêm 1 dòng mới thay
vì sửa dòng cũ, tạo ra:

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_AUTHENTICATION_CLASSES": ("accounts.authentication.BlacklistAwareJWTAuthentication",),
}
```

Python không cấm dict literal có key trùng tên — nó lặng lẽ giữ lại giá
trị của lần khai báo **cuối cùng**, bỏ qua các lần trước:

```python
{"a": 1, "a": 2}   # → kết quả là {"a": 2}, không báo lỗi gì
```

May mắn là giá trị đúng (`BlacklistAwareJWTAuthentication`) được khai báo
sau, nên "thắng" — code vẫn chạy đúng theo ý muốn, nhưng dòng đầu trở
thành code chết, gây hiểu lầm cho người đọc sau. Cách sửa: xóa dòng dư,
chỉ giữ 1 key duy nhất.

## Bài học chung — phân loại 3 mức độ nguy hiểm của lỗi đã gặp

| Loại lỗi | Ví dụ | Mức độ lộ ra |
|---|---|---|
| Sai tên biến/method | `tji` | Crash ngay, traceback rõ |
| Sai 1 chữ trong **chuỗi string** dùng làm key tra cứu | `backlist` | Im lặng, không crash, sai kết quả ngầm |
| Trùng key trong dict literal | 2x `DEFAULT_AUTHENTICATION_CLASSES` | Im lặng, Python tự lấy giá trị cuối, không báo gì |

Cả 3 đều là hệ quả của việc Python không có compiler kiểm tra tên định
danh như Java — cách phòng ngừa thực tế: luôn xác nhận bằng kết quả test
cụ thể (in giá trị ra màn hình, gọi API thật), không chỉ tin "code chạy
không lỗi" là đủ.
