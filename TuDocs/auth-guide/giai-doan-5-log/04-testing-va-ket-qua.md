# 04 — Testing & Kết quả thực tế

## Dữ liệu test

3 tài khoản đã có sẵn từ trước, tất cả tự động thành `must_change_password=True`
sau migration `0004` (xem `01-must-change-password-field.md`):

```text
admin@worktracker.com      — role ADMIN, có quyền user:disable
manager@worktracker.com    — role MANAGER
employee@worktracker.com   — role EMPLOYEE
```

## 5 test case

### Test 1 — Login

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" -d '{"email":"admin@worktracker.com","password":"<password hiện tại>"}'
```

```json
{"access":"eyJ...","refresh":"eyJ...","user":{"id":1,"email":"admin@worktracker.com","role":"ADMIN","must_change_password":true}}
```

✅ Đúng kỳ vọng — `must_change_password: true` xuất hiện trong response.

### Test 2 — Gọi API role-gated khi chưa đổi password

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://127.0.0.1:8000/api/auth/user/<id>/disable/" \
  -H "Authorization: Bearer <access_token>"
```

```text
{"detail":"You must change your password before performing this action."}
HTTP_STATUS:403
```

✅ Đúng kỳ vọng — message riêng biệt, không phải message chung "no permission" (xác nhận `HasPermission` đã chặn đúng nhánh).

### Test 3 — Đổi password đúng

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/change-password/ \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"old_password":"<password cũ>","new_password":"FinalPass@789"}'
```

```text
{"detail":"Password changed successfully"}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng.

### Test 4 — Gọi lại API role-gated sau khi đổi password

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://127.0.0.1:8000/api/auth/user/<id>/disable/" \
  -H "Authorization: Bearer <access_token>"
```

```text
{"detail":"User disabled"}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng — không còn bị chặn, vì `must_change_password` đã chuyển
`False` ở Test 3, và token cũ vẫn dùng được (không cần login lại — claim
`must_change_password` không nằm trong JWT, chỉ đọc trực tiếp từ DB mỗi
request qua `HasPermission`, nên cập nhật có hiệu lực ngay).

### Test 5 — Đổi password với `old_password` sai

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/change-password/ \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"old_password":"SaiRoi@123","new_password":"KhacGiPass@000"}'
```

```text
{"non_field_errors":["Current password is incorrect."]}
HTTP_STATUS:400
```

✅ Đúng kỳ vọng.

## Bảng tổng hợp

| # | Trường hợp | Kỳ vọng | Thực tế |
|---|---|---|---|
| 1 | Login | `must_change_password: true` | ✅ |
| 2 | Gọi API role-gated khi chưa đổi | 403, message riêng | ✅ |
| 3 | Đổi password đúng | 200 | ✅ |
| 4 | Gọi lại API role-gated sau khi đổi | 200 | ✅ |
| 5 | Đổi password với old_password sai | 400 | ✅ |

**Giai đoạn 5 (Account Lifecycle, phạm vi đã thu hẹp) hoàn tất** — 5/5 test
case đúng kỳ vọng.

## Dọn dẹp sau test

Trả cả 3 tài khoản test về trạng thái bình thường để dùng tiếp cho các
Giai đoạn sau:

```python
from accounts.models import CustomUser
for email in ['admin@worktracker.com', 'manager@worktracker.com', 'employee@worktracker.com']:
    u = CustomUser.objects.get(email=email)
    u.is_active = True
    u.must_change_password = False
    u.save()
```
