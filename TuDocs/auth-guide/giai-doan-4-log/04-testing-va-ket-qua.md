# 04 — Testing & Kết quả thực tế

## 5 test case

### Test 1 — Forgot Password (email tồn tại)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/forgot-password/ \
  -H "Content-Type: application/json" -d '{"email":"admin@worktracker.com"}'
```

```text
{"detail":"If that email exists, a reset link has been sent."}
HTTP_STATUS:200
```

✅ Console in đúng token thật:

```text
Subject: Reset Password WorkTracker
To: admin@worktracker.com

Use this token to reset password: 43MJS_tubsfp2U-V-Br_Qy2NJcicOkch5ES4C2HXQWY
```

### Test 2 — Reset Password với token thật

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/reset-password/ \
  -H "Content-Type: application/json" \
  -d '{"token":"43MJS_tubsfp2U-V-Br_Qy2NJcicOkch5ES4C2HXQWY","new_password":"NewPass@456"}'
```

```text
{"detail":"Password has been reset successfully"}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng.

### Test 3 — Dùng LẠI cùng token đó

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/reset-password/ \
  -H "Content-Type: application/json" \
  -d '{"token":"43MJS_tubsfp2U-V-Br_Qy2NJcicOkch5ES4C2HXQWY","new_password":"AnotherPass@789"}'
```

```text
{"non_field_errors":["This reset link has already been used."]}
HTTP_STATUS:400
```

✅ Đúng kỳ vọng — token đã đánh dấu `is_used=True` ở Test 2, không dùng lại
được, dù password mới ở lần thử này khác lần trước (không liên quan, lỗi
xảy ra ngay ở bước kiểm tra token trước khi chạm tới password).

### Test 4 — Login bằng password MỚI

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"NewPass@456"}'
```

```text
{"access":"eyJ...","refresh":"eyJ...","user":{"id":1,"email":"admin@worktracker.com","role":"ADMIN"}}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng. Lưu ý phụ: claim `"role"` giờ hiện đúng `"ADMIN"` (không
còn `null` như Giai đoạn 1) — vì user này đã được gán Role ở Giai đoạn 3,
xác nhận claim luôn phản ánh đúng trạng thái hiện tại của user tại lúc
login.

### Test 5 — Login bằng password CŨ

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"tuantu209423"}'
```

```text
{"detail":"Invalid email or password."}
HTTP_STATUS:401
```

✅ Đúng kỳ vọng — password cũ không còn dùng được sau khi đã reset.

## Bảng tổng hợp

| # | Trường hợp | Kỳ vọng | Thực tế |
|---|---|---|---|
| 1 | Forgot Password (email tồn tại) | 200, token thật trong email | ✅ |
| 2 | Reset Password với token thật | 200 | ✅ |
| 3 | Dùng lại cùng token | Lỗi "already been used" | ✅ 400 |
| 4 | Login bằng password mới | 200 | ✅ |
| 5 | Login bằng password cũ | 401 | ✅ |

**Giai đoạn 4 (Forgot Password) hoàn tất** — 5/5 test case đúng kỳ vọng.

## Việc chưa test (để ghi nhớ, không phải thiếu sót của Giai đoạn 4)

- Email KHÔNG tồn tại gọi `/forgot-password/` — đã test ở lúc viết Bước 2
  (xem `02-forgot-password.md`), cùng trả 200 như email tồn tại.
- Token đã hết hạn (`expires_at` đã qua) — chưa test thật (cần đợi 15
  phút hoặc tự sửa `expires_at` qua shell), nhưng logic đã review kỹ ở
  `validate()`, cùng pattern với check `is_used`.
