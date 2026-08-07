# Giai đoạn 4 — Forgot Password: Tổng quan quá trình thực hiện

Bản ghi lại quá trình triển khai **Giai đoạn 4** trong roadmap ở
`auth-guide/11-giai-doan-4-roadmap.md`, nối tiếp `giai-doan-3-log/`. Mục
tiêu: người dùng quên mật khẩu tự khôi phục qua email, không cần Admin
reset tay.

## Phạm vi đã hoàn thành

- Cấu hình `EMAIL_BACKEND` (console, dev) — và thử cả lựa chọn Gmail SMTP
  trước khi quyết định giữ console cho giai đoạn dev.
- `ForgotPasswordSerializer` + `ForgotPasswordView` — sinh token, gửi email,
  luôn trả 200 dù email tồn tại hay không.
- `ResetPasswordSerializer` + `ResetPasswordView` — verify token (tồn tại/
  chưa dùng/chưa hết hạn), đổi password.
- Integration test 5 trường hợp — toàn bộ đạt kết quả mong đợi.

## Cây file đã sửa

```text
backend/
├── worktracker_core/settings.py   ← sửa: thêm EMAIL_BACKEND, DEFAULT_FROM_EMAIL
├── accounts/
│   ├── serializers_auth.py         ← sửa: thêm ForgotPasswordSerializer, ResetPasswordSerializer
│   ├── views_auth.py               ← sửa: thêm ForgotPasswordView, ResetPasswordView
│   └── urls_auth.py                ← sửa: thêm 2 route mới
```

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-email-backend-config.md](01-email-backend-config.md) | Console backend vs SMTP thật, vì sao giữ console cho dev, lỗi `smtp`/`console` gõ ngược ý định |
| 2 | [02-forgot-password.md](02-forgot-password.md) | `ForgotPasswordSerializer`/`View`, anti user-enumeration, lỗi thiếu `f`-string khiến token không hiện trong email |
| 3 | [03-reset-password.md](03-reset-password.md) | `ResetPasswordSerializer`/`View`, 3 message lỗi riêng biệt, bug `kargs`/`validation_data` |
| 4 | [04-testing-va-ket-qua.md](04-testing-va-ket-qua.md) | 5 test case Integration Test với kết quả thật |

## Nguyên tắc đáng nhớ nhất rút ra từ Giai đoạn 4

1. **Tách cấu hình hạ tầng (EMAIL_BACKEND) ra khỏi logic nghiệp vụ** — test
   "gửi mail có chạy không" độc lập với "logic Forgot Password có đúng
   không", giống cách đã làm với Redis ở Giai đoạn 2.
2. **f-string thiếu tiền tố `f` là lỗi âm thầm nguy hiểm** — chuỗi
   `"...{reset.token}"` không có `f` vẫn là code hợp lệ, không crash, chỉ
   in ra sai nội dung — API vẫn trả 200, nhưng dữ liệu thật (token) không
   bao giờ tới được người dùng.
3. **`self.validated_data` (DRF) dễ gõ nhầm thành `self.validation_data`**
   — một biến thể mới của lớp lỗi "sai tên thuộc tính" đã gặp nhiều lần,
   lần này ở chính attribute lõi của framework, không phải attribute tự
   đặt tên.
4. **Không phải mọi lỗi đều cần message giống nhau** — gộp message để
   chống enumeration (Login) chỉ áp dụng khi thông tin có thể bị "dò" bằng
   cách thử nhiều lần; token ngẫu nhiên 32-byte thì không có rủi ro đó, nên
   tách 3 message lỗi riêng (token sai/đã dùng/hết hạn) là đúng, không phải
   thiếu sót bảo mật.
