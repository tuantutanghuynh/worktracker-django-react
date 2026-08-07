# 05 — Testing & Kết quả thực tế

## Sự cố phụ: Pylance báo "Import could not be resolved"

Trước khi test, gặp 1 lỗi không liên quan tới logic code: VSCode/Pylance
báo gạch đỏ `Import "rest_framework.views" could not be resolved` ở
`views.py` (sau này tách thành `views_auth.py`).

### Nguyên nhân

Đây **không phải lỗi runtime Python** — `rest_framework` đã cài đúng trong
`backend/.venv` (xác nhận bằng `.venv/bin/python -c "import rest_framework"`
chạy thành công). Lỗi chỉ là Pylance (công cụ phân tích cú pháp của VSCode)
đang soi code bằng **một Python interpreter khác**, không phải
`backend/.venv` — vì VSCode mở workspace ở thư mục gốc repo, còn venv lại
nằm lồng 1 cấp trong `backend/.venv`, nên không tự động dò ra được trong
danh sách gợi ý.

### Cách sửa — không phụ thuộc vào danh sách gợi ý tự động của VSCode

Tạo file `.vscode/settings.json` ở **thư mục gốc repo** (không phải trong
`backend/`), trỏ thẳng đường dẫn:

```json
{
    "python.defaultInterpreterPath": "${workspaceFolder}/backend/.venv/bin/python"
}
```

Sau đó `Cmd+Shift+P` → **Developer: Reload Window** để VSCode đọc lại
config. Đây là cách đáng tin cậy hơn việc bấm chọn thủ công qua **Python:
Select Interpreter**, vì không phụ thuộc danh sách auto-detect của VSCode
có quét đúng thư mục lồng nhau hay không.

## Chuẩn bị dữ liệu test

Bảng `users` ban đầu rỗng — tạo 1 tài khoản test bằng lệnh có sẵn của
Django (không tự viết script, vì lệnh này đã tự xử lý đúng `USERNAME_FIELD`
+ `REQUIRED_FIELDS` đã khai báo trong `CustomUser`):

```bash
python manage.py createsuperuser
```

Lệnh hỏi lần lượt **Email**, **Username**, **Password** — tạo tài khoản
`admin@worktracker.com`.

## Khởi động server và test bằng `curl`

```bash
python manage.py runserver 8000
```

### Test 1 — Sai password (kỳ vọng 401)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"sai-password"}'
```

```text
{"detail":"Invalid email or password."}
HTTP_STATUS:401
```

✅ Đúng kỳ vọng.

### Test 2 — Đúng email/password (kỳ vọng 200)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"<password của bạn>"}'
```

```text
{"access":"eyJ...","refresh":"eyJ...","user":{"id":1,"email":"admin@worktracker.com","role":null}}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng. `role: null` là hợp lý vì tài khoản test chưa được gán
`Role` nào. Giải mã phần payload của access token (đoạn giữa, base64) xác
nhận đúng 2 claim tùy biến đã gắn:

```json
{
  "token_type": "access",
  "exp": 1782055053,
  "iat": 1782054153,
  "jti": "7d4ddb7ec8264fd98824d4c43a967a66",
  "user_id": "1",
  "email": "admin@worktracker.com",
  "role": null
}
```

### Test 3 — Refresh token (kỳ vọng 200, access mới + refresh mới)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<refresh token từ Test 2>"}'
```

```text
{"access":"eyJ...","refresh":"eyJ..."}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng. Trả về **cả access token mới và refresh token mới** (vì
`ROTATE_REFRESH_TOKENS=True`) — claim `email`/`role` vẫn được giữ nguyên
trong access token mới, xác nhận đúng cơ chế "claim tự copy qua payload" đã
giải thích ở file 03.

### Test 4 — Tài khoản bị khóa (kỳ vọng 403)

Tạm set `is_active=False` cho tài khoản test qua shell, sau đó gọi lại với
đúng password:

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"<password của bạn>"}'
```

```text
{"detail":"User account is disabled. Please contact the administrator."}
HTTP_STATUS:403
```

✅ Đúng kỳ vọng — khác `detail` và khác status code so với Test 1, đúng yêu
cầu thiết kế tách biệt 401/403.

Sau test, set lại `is_active=True` để tài khoản dùng được bình thường.

## Bảng tổng hợp kết quả

| # | Trường hợp | Status mong đợi | Status thực tế | Kết quả |
|---|---|---|---|---|
| 1 | Sai password | 401 | 401 | ✅ |
| 2 | Đúng email/password | 200 | 200 | ✅ |
| 3 | Refresh token | 200 | 200 | ✅ |
| 4 | Tài khoản bị khóa | 403 | 403 | ✅ |

**Giai đoạn 1 (Khung xương Login) hoàn tất** — 4/4 test case đúng kỳ vọng.
