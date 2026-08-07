# Giai đoạn 1 — Khung xương Login: Tổng quan quá trình thực hiện

Đây là bản ghi lại toàn bộ quá trình triển khai **Giai đoạn 1** trong roadmap
ở `auth-guide/08-roadmap-and-talking-points.md` — bao gồm câu hỏi, lý do kỹ
thuật, code thật, các lỗi đã gặp và cách sửa. Mục tiêu của series này khác
với series `auth-guide` gốc: ở đó là kiến thức nền **trước khi code**, ở đây
là **nhật ký thực tế đã code** — dùng để bạn ôn lại và trình bày cho team
hiểu chính xác "đã làm gì, vì sao làm vậy, kết quả ra sao".

## Phạm vi đã hoàn thành

Login bằng email/password, sinh JWT (access 15 phút, refresh 7 ngày, có
rotation), kèm theo logic phân biệt rõ "sai thông tin đăng nhập" (401) và
"tài khoản bị khóa" (403) — đúng yêu cầu thiết kế ở `auth-guide/03-login-logout-flow.md`.

## Cây file đã tạo/sửa

```text
backend/
├── worktracker_core/
│   ├── settings.py     ← sửa: thêm REST_FRAMEWORK, SIMPLE_JWT, token_blacklist app
│   └── urls.py          ← sửa: mount accounts.urls_auth vào "api/auth/"
├── accounts/
│   ├── serializers_auth.py   ← tạo mới: LoginSerializer
│   ├── views_auth.py         ← sửa: LoginView
│   └── urls_auth.py          ← tạo mới: route login/, refresh/
└── .vscode/
    └── settings.json     ← tạo mới (ở gốc repo): trỏ đúng Python interpreter cho VSCode
```

## Thứ tự đọc các file trong series này

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-cau-hinh-settings.md](01-cau-hinh-settings.md) | Cấu hình `SIMPLE_JWT`/`REST_FRAMEWORK`, 3 lỗi typo đã gặp và bài học về "lỗi âm thầm" trong Python |
| 2 | [02-serializer-login.md](02-serializer-login.md) | `LoginSerializer` — vì sao không kế thừa `TokenObtainPairSerializer`, lỗi `AttributeError` và cách phòng thủ |
| 3 | [03-view-login-refresh.md](03-view-login-refresh.md) | `LoginView`, vì sao không cần `try/except`, vì sao tái dùng `TokenRefreshView` có sẵn |
| 4 | [04-urls-routing.md](04-urls-routing.md) | Kiến trúc routing 2 tầng Project → App |
| 5 | [05-testing-va-ket-qua.md](05-testing-va-ket-qua.md) | Kết quả test 4 trường hợp, lệnh `curl` thật, và sự cố Pylance/VSCode interpreter |

## Nguyên tắc xuyên suốt cả 5 bước (đáng nhớ nhất để trình bày với team)

1. **JWT là tự chứa dữ liệu (self-contained)** — mọi claim tùy biến
   (`email`, `role`) phải được gắn vào *trước* khi đọc `access_token`, vì
   cơ chế copy diễn ra tại thời điểm đọc, không tự động đồng bộ về sau.
2. **DRF có exception handler toàn cục** — chỉ cần `raise` đúng loại
   exception (`AuthenticationFailed`, `PermissionDenied`), không cần tự viết
   `try/except` để convert sang HTTP status, khác với thói quen Controller
   bên Java.
3. **Python không có compiler kiểm tra tên field/key** — sai một chữ trong
   string key (`SIMPLE_JWT`) hoặc đường dẫn module (`permission_classes`) có
   thể **âm thầm không báo lỗi gì**, nguy hiểm hơn cả lỗi crash ngay.
4. **Bảo mật qua việc "trả lời mơ hồ có chủ đích"** — cùng 1 thông báo lỗi
   cho nhiều nguyên nhân khác nhau (email không tồn tại / sai password) để
   không lộ thông tin cho kẻ tấn công.
