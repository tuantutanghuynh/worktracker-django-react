# Giai đoạn 2 — Logout & Redis Blacklist: Tổng quan quá trình thực hiện

Bản ghi lại toàn bộ quá trình triển khai **Giai đoạn 2** trong roadmap ở
`auth-guide/09-giai-doan-2-roadmap.md` — nối tiếp `giai-doan-1-log/`. Mục
tiêu: token đã logout phải mất tác dụng **ngay lập tức**, không chờ 15
phút tự hết hạn.

## Phạm vi đã hoàn thành

- Setup Redis, kết nối từ Django qua 1 client dùng chung.
- `LogoutView`: lấy `jti`/`exp` từ token đang dùng, ghi vào Redis blacklist với TTL = thời gian còn lại của token.
- `BlacklistAwareJWTAuthentication`: override `JWTAuthentication` của SimpleJWT, tự kiểm tra blacklist trước khi tin token.
- Integration test 5 trường hợp — toàn bộ đạt kết quả mong đợi.

## Cây file đã tạo/sửa

```text
backend/
├── worktracker_core/settings.py   ← sửa: thêm REDIS_HOST/PORT/DB, đổi
│                                      DEFAULT_AUTHENTICATION_CLASSES
├── accounts/
│   ├── redis_client.py             ← tạo mới: connection Redis dùng chung
│   ├── authentication.py          ← tạo mới: BlacklistAwareJWTAuthentication
│   ├── views_auth.py               ← sửa: thêm LogoutView
│   └── urls_auth.py                ← sửa: thêm route logout/
```

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-redis-setup.md](01-redis-setup.md) | Cài Redis, vì sao không dùng `django-redis`, connection object dùng chung |
| 2 | [02-logout-view.md](02-logout-view.md) | `LogoutView`, lấy claim qua `request.auth`, bug thụt lề khiến thiếu `return` |
| 3 | [03-custom-authentication.md](03-custom-authentication.md) | `BlacklistAwareJWTAuthentication`, 3 bug thật đã gặp (2 typo + 1 key trùng trong dict) |
| 4 | [04-testing-va-ket-qua.md](04-testing-va-ket-qua.md) | 5 test case Integration Test và kết quả thật |
| 5 | [05-su-co-bao-mat-password.md](05-su-co-bao-mat-password.md) | Sự cố lộ password Postgres thật lên git, cách xử lý |

## Nguyên tắc đáng nhớ nhất rút ra từ Giai đoạn 2

1. **Tận dụng lại công đoạn framework đã làm** — `request.auth` (đã được
   `JWTAuthentication` validate sẵn) thay vì tự parse header; override đúng
   1 method (`get_validated_token`) thay vì viết lại toàn bộ class xác thực.
2. **Thụt lề ở Python là cú pháp, không phải trang trí** — đặt sai 1 cấp
   thụt lề có thể khiến 1 nhánh code "biến mất" một cách hợp lệ về cú pháp,
   chỉ lộ ra khi test đúng edge case.
3. **2 loại lỗi typo khác mức độ nguy hiểm**: lỗi tên biến/method sai (`tji`)
   gây crash ngay, dễ phát hiện; lỗi sai 1 chữ trong **chuỗi string** dùng
   làm key tra cứu (`backlist` vs `blacklist`) thì **âm thầm vô hiệu hóa
   toàn bộ logic** mà không có dấu hiệu gì — nguy hiểm hơn nhiều.
4. **Không bao giờ hardcode secret thật vào file sẽ commit** — dù sửa đi
   sửa lại, git vẫn giữ lại mọi giá trị đã từng commit trong lịch sử.
