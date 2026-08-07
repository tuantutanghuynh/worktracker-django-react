# 01 — Cấu hình `EMAIL_BACKEND`

## Vì sao cấu hình email trước khi viết `ForgotPasswordView`

`ForgotPasswordView` sắp viết sẽ gọi `django.core.mail.send_mail()` — hàm
này cần biết "gửi email kiểu gì" trước khi có thể gọi. Nếu chưa cấu hình,
Django dùng SMTP thật làm default (`EMAIL_HOST='localhost'`,
`EMAIL_PORT=25`) — sẽ lỗi kết nối ngay vì máy dev không có SMTP server nào
chạy ở đó. Tách riêng "cấu hình gửi mail có đúng chưa" khỏi "logic Forgot
Password có đúng không" — giống nguyên tắc đã áp dụng khi setup Redis ở
Giai đoạn 2 (test kết nối trước, viết logic sau).

## Console backend — lựa chọn cho môi trường dev

```python
# Dev: email được IN RA TERMINAL, không gửi thật — đủ để test luồng
# mà không cần tài khoản SMTP. Sẽ đổi sang SMTP (Gmail) khi cần demo thật.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'no-reply@worktracker.com'
```

Với backend này, gọi `send_mail()` không gửi gì ra Internet — nội dung
email được in thẳng ra terminal đang chạy `runserver`. Đủ để xác nhận
logic sinh token đúng, không cần lo giới hạn gửi mail hay phải tạo tài
khoản SMTP khi đang code/test lặp lại nhiều lần.

## Lựa chọn đã xem xét: Gmail SMTP thật

Tài liệu yêu cầu gốc cũng cho phép dùng Gmail/SendGrid qua SMTP. Cách cấu
hình (ghi lại để dùng khi cần demo thật cho team):

```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
```

Lưu ý quan trọng nếu dùng cách này: Gmail **chặn đăng nhập SMTP bằng
password tài khoản thật** từ 2022 — phải bật xác thực 2 bước rồi tạo **App
Password** riêng (16 ký tự) tại `myaccount.google.com/apppasswords`, dùng
App Password đó cho `EMAIL_HOST_PASSWORD` — không dùng password đăng nhập
Gmail thật. Và `EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD` phải để trong
`.env` (không hardcode), đúng bài học đã rút ra từ sự cố lộ password
Postgres ở Giai đoạn 2.

**Quyết định cuối**: giữ console backend cho giai đoạn dev, vì Gmail SMTP
giới hạn số email/ngày cho tài khoản cá nhân — không phù hợp khi cần test
lại nhiều lần liên tục. Chỉ nên đổi sang Gmail 1 lần khi cần demo thật cho
team.

## Bug đã gặp: gõ ngược `smtp` ↔ `console`

Sau khi đã chốt quyết định giữ console backend, lần gõ đầu tiên lại viết:

```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'   # SAI — ngược ý định
```

Vì chưa khai báo `EMAIL_HOST`/`EMAIL_PORT` nào, Django dùng default
(`localhost:25`) — khi `send_mail()` chạy thật ở Bước 2, sẽ ném
`ConnectionRefusedError` (không có SMTP server nào ở đó). Bài học: khi đã
quyết định 1 trong 2 lựa chọn rõ ràng (`smtp` vs `console`), dễ gõ lộn ngược
lại lựa chọn không phải vì không hiểu, mà vì 2 chữ này dễ lẫn khi gõ nhanh
— nên luôn xác nhận lại bằng cách đọc lại đúng dòng đã gõ, không chỉ tin là
đã làm đúng theo ý đã nói ra miệng.

```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'   # ĐÚNG
```
