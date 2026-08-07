# 01 — Cấu hình `REST_FRAMEWORK` + `SIMPLE_JWT`

## Câu hỏi mở đầu: vì sao bắt đầu từ cấu hình, không bắt đầu từ code Login ngay

So với đồ án Java JavaFX trước đây của Tuấn Tú (`DatabaseConfig` phải khởi
tạo đúng trước khi `UserRepository` dùng được), `SIMPLE_JWT` đóng vai trò
tương tự — là cấu hình toàn cục quyết định "JWT sinh ra kiểu gì, sống bao
lâu, payload chứa gì". Nếu chưa khai báo, mọi code viết sau sẽ dùng giá trị
mặc định của thư viện, không khớp với yêu cầu thiết kế (access 15 phút,
refresh 7 ngày, có rotation).

## Vì sao cần khai báo riêng `DEFAULT_AUTHENTICATION_CLASSES`

Đây là điểm dễ bị quên nhất khi mới làm JWT với DRF: cấu hình `SIMPLE_JWT`
chỉ dạy Django **cách sinh ra token**, không dạy Django **cách đọc token đó
ở các request sau**. Thiếu khai báo `DEFAULT_AUTHENTICATION_CLASSES`, hiện
tượng gặp phải sẽ là: login thành công, có token, nhưng gọi API khác kèm
token vẫn bị 401 — vì Django chưa biết phải tra cứu token bằng class nào.

## Code cuối cùng (đã sửa lỗi) — `backend/worktracker_core/settings.py`

```python
# CHỈ ĐỊNH SỬ DỤNG BẢNG USER TÙY BIẾN THAY VÌ MẶC ĐỊNH CỦA DJANGO
AUTH_USER_MODEL = 'accounts.CustomUser'

# REST FRAMEWORK CONFIGURATION
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
```

Và trong `INSTALLED_APPS`, thêm app quản lý blacklist của thư viện:

```python
INSTALLED_APPS = [
    # ... các app đã có
    'rest_framework_simplejwt.token_blacklist',
]
```

Sau đó chạy `makemigrations` + `migrate` để tạo bảng cho app này (app có
model riêng để lưu refresh token đã rotate).

## Lưu ý: có 2 "blacklist" khác nhau, đừng nhầm

`BLACKLIST_AFTER_ROTATION = True` ở trên dùng **blacklist của thư viện
SimpleJWT**, lưu trong Postgres, chỉ quản lý "refresh token cũ sau khi
rotate có còn dùng được không". Đây **khác hoàn toàn** với blacklist Redis
tự code cho hành động Logout đã phân tích ở `auth-guide/02-jwt-and-tokens.md`
— 2 cơ chế độc lập, không thay thế nhau. Blacklist Redis cho Logout sẽ làm ở
Giai đoạn 2 (chưa làm trong Giai đoạn 1 này).

## 3 lỗi thực tế đã gặp khi gõ lại đoạn cấu hình trên

Đây là phần đáng nói nhất của bước này — minh chứng sống cho một nguyên tắc
quan trọng khi chuyển từ Java sang Python.

### Lỗi 1 — sai đường dẫn module, **crash ngay khi gọi API**

```python
# Đã gõ (SAI):
"DEFAULT_PERMISSION_CLASSES": ("rest_framework_permissions.IsAuthenticated",),

# Đúng:
"DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
```

Không có module nào tên `rest_framework_permissions` (gạch dưới nối liền) —
đúng phải là `rest_framework.permissions` (có dấu `.` ngăn cách). Lỗi này
**nổ ngay** khi gọi API cần xác thực: Django cố `import` module không tồn
tại, ném `ModuleNotFoundError`. Dễ phát hiện vì traceback hiện rõ ràng.

### Lỗi 2 & 3 — sai tên key, **âm thầm không báo lỗi gì cả**

```python
# Đã gõ (SAI):
"REFESH_TOKEN_LIFETIME": timedelta(days=7),   # thiếu chữ R
"ROTATE_REFESH_TOKENS": True,                  # thiếu chữ R

# Đúng:
"REFRESH_TOKEN_LIFETIME": timedelta(days=7),
"ROTATE_REFRESH_TOKENS": True,
```

Đây là lỗi **nguy hiểm hơn lỗi 1** dù trông "nhẹ" hơn (chỉ thiếu 1 chữ).
Thư viện SimpleJWT chỉ đọc đúng những key đã định nghĩa sẵn trong code của
nó — key sai tên **không hề báo lỗi**, mà bị lặng lẽ bỏ qua, hệ thống tự
dùng giá trị default của thư viện (refresh token sống **1 ngày**, **không**
rotation). Hậu quả: tưởng đã cấu hình đúng theo yêu cầu (7 ngày + rotation),
nhưng hệ thống thật chạy sai mà không một dòng log nào cảnh báo.

## Bài học cốt lõi — khác biệt nền tảng giữa Java và Python ở đây

Java: gõ sai tên field thường bị **compiler chặn ngay lúc build**, không
chạy được. Python: dict với string key sai chỉ **lặng lẽ bị bỏ qua lúc
runtime** — không có lưới an toàn nào bắt lỗi này cho bạn. Đây là lý do
*"chạy `migrate` không báo lỗi"* **không đồng nghĩa** với *"cấu hình đã
đúng"*.

## Cách tự kiểm tra để không bị lỗi loại 2-3 này

```bash
python manage.py shell -c "
from django.conf import settings
print('REST_FRAMEWORK:', settings.REST_FRAMEWORK)
print('SIMPLE_JWT:', settings.SIMPLE_JWT)
"
```

Kết quả đúng phải thấy:

```text
REST_FRAMEWORK: {'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',), 'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',)}
SIMPLE_JWT: {'ACCESS_TOKEN_LIFETIME': datetime.timedelta(seconds=900), 'REFRESH_TOKEN_LIFETIME': datetime.timedelta(days=7), 'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': True}
```

`seconds=900` = 15 phút — đúng kỳ vọng. In ra và đọc bằng mắt là cách duy
nhất chắc chắn phát hiện lỗi loại "sai tên key âm thầm" này.
