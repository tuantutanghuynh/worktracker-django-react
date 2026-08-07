# 04 — Integration Test & Kết quả thực tế

## 5 trường hợp test theo issue `[Auth][Day 3]`

### Test 1 — Login

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"<password của bạn>"}'
```

```json
{
    "access": "eyJ...",
    "refresh": "eyJ...",
    "user": { "id": 1, "email": "admin@worktracker.com", "role": null }
}
```

✅ 200, đúng kỳ vọng.

### Test 2 — Logout lần 1 bằng access token đó

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/logout/ \
  -H "Authorization: Bearer <access_token>"
```

```text
{"detail":"Logged out successfully."}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng. Xác nhận key đã vào Redis:

```bash
redis-cli -n 1 keys "blacklist:*"
# blacklist:787610b9d514421e966f9d745ec8cabd
redis-cli -n 1 ttl "blacklist:787610b9d514421e966f9d745ec8cabd"
# 900   (khớp đúng 15 phút = ACCESS_TOKEN_LIFETIME)
```

### Test 3 — Gọi LẠI Logout bằng CÙNG access token đã bị blacklist

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/logout/ \
  -H "Authorization: Bearer <access_token cũ>"
```

```text
{"detail":"Token has been revoked."}
HTTP_STATUS:401
```

✅ Đúng kỳ vọng — đây là bằng chứng `BlacklistAwareJWTAuthentication` hoạt
động thật, không chỉ "không crash" (xem `03-custom-authentication.md` về
lý do test này quan trọng hơn các test trước).

### Test 4 — Login lại lấy access token MỚI

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worktracker.com","password":"<password của bạn>"}'
```

✅ Access token mới khác hoàn toàn access token cũ (xác nhận bằng so sánh
chuỗi 2 token không trùng nhau).

### Test 5 — Dùng access token MỚI gọi Logout

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://127.0.0.1:8000/api/auth/logout/ \
  -H "Authorization: Bearer <access_token mới>"
```

```text
{"detail":"Logged out successfully."}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng — xác nhận blacklist chỉ chặn đúng `jti` cụ thể đã logout,
không chặn nhầm token khác (kể cả của cùng user).

## Bảng tổng hợp

| # | Trường hợp | Kỳ vọng | Thực tế |
|---|---|---|---|
| 1 | Login | 200 | ✅ 200 |
| 2 | Logout lần 1 | 200, key vào Redis với TTL ≈ 900s | ✅ |
| 3 | Dùng lại token đã logout | 401 | ✅ 401, `"Token has been revoked."` |
| 4 | Login lại, token mới | 200, khác token cũ | ✅ |
| 5 | Token mới hoạt động bình thường | 200, không bị chặn nhầm | ✅ |

**Giai đoạn 2 (Logout & Redis Blacklist) hoàn tất** — 5/5 test case đúng
kỳ vọng.

## Lưu ý môi trường gặp phải trong lúc test (không liên quan logic JWT)

Trong quá trình test, server Django bị crash nhiều lần do **lỗi cú pháp ở
file khác** (`accounts/urls_auth.py` thiếu dấu phẩy, `views_auth.py` gõ nhầm `form`
thay vì `from`) — khi 1 file trong app có `SyntaxError`, Django không tải
được route nào trong file đó, nhưng autoreloader đôi khi vẫn giữ server cũ
chạy với route cũ, gây hiện tượng "API mới báo 404" dễ nhầm là lỗi routing
trong khi thực chất là lỗi cú pháp ở nơi khác. Cách chẩn đoán nhanh: chạy
`python manage.py check` trước khi nghi ngờ logic — lệnh này luôn lộ
`SyntaxError`/`ImportError` ngay, nhanh hơn dò qua log server.
