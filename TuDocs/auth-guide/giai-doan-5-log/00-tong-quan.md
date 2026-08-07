# Giai đoạn 5 — Account Lifecycle: Tổng quan quá trình thực hiện

Bản ghi lại quá trình triển khai **Giai đoạn 5** (đã thu hẹp phạm vi sau khi
áp dụng "3 Quy tắc vàng để ghép code vô trùng 100%" — xem
`TuDocs/project-roadmap/00-tong-quan.md`), nối tiếp `giai-doan-4-log/`. Mục
tiêu: bắt buộc đổi mật khẩu ở lần đăng nhập đầu (hoặc sau khi Admin tạo
account/reset password), không cho dùng các API khác cho tới khi đổi xong.

## Vì sao phạm vi Giai đoạn 5 thu hẹp lại so với roadmap gốc

Roadmap gốc (`auth-guide/08-roadmap-and-talking-points.md`) ghi Giai đoạn 5
gồm cả "API Admin tạo user mới" và "API mở lại tài khoản". Sau khi áp dụng
mô hình "app `accounts` dùng chung, mỗi vai trò viết file riêng"
(`views_admin.py`...), 2 việc đó chuyển thành **Minh Anh tự viết** vào
`accounts/views_admin.py` của cô ấy — không còn thuộc việc của Tuấn Tú.
Giai đoạn 5 thực tế chỉ còn đúng phần lõi: `must_change_password`.

## Phạm vi đã hoàn thành

- Thêm field `must_change_password` vào `CustomUser` + migration.
- `LoginSerializer` trả `must_change_password` trong response để Frontend
  biết khi nào cần redirect.
- `ChangePasswordSerializer`/`ChangePasswordView` — đổi password khi đang
  đăng nhập (khác hẳn luồng Forgot/Reset dùng token qua email).
- Chặn `HasPermission` khi `must_change_password=True` — áp dụng tự động
  cho **mọi** view dùng `HasPermission`, không chỉ riêng view của Tuấn Tú.
- Integration test 5 trường hợp — toàn bộ đạt kết quả mong đợi.

## Cây file đã tạo/sửa

```text
backend/accounts/
├── models.py                          ← sửa: thêm must_change_password vào CustomUser
├── migrations/0004_customuser_must_change_password.py  ← tạo mới
├── serializers_auth.py                ← sửa: must_change_password trong LoginSerializer;
│                                         thêm ChangePasswordSerializer
├── views_auth.py                      ← sửa: thêm ChangePasswordView
├── urls_auth.py                       ← sửa: thêm route change-password/
└── permissions.py                     ← sửa: HasPermission chặn must_change_password
```

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-must-change-password-field.md](01-must-change-password-field.md) | Field mới, hệ quả `default=True` lên user cũ, bug ký tự lạ `ß` |
| 2 | [02-change-password-view.md](02-change-password-view.md) | `ChangePasswordSerializer`/`View`, vì sao khác `Login`/`Reset`, vì sao thiếu dấu `/` gây 404 |
| 3 | [03-has-permission-gate.md](03-has-permission-gate.md) | Chặn trong `HasPermission`, vì sao không đặt ở tầng Authentication, vì sao `ChangePasswordView` không tự chặn chính nó |
| 4 | [04-testing-va-ket-qua.md](04-testing-va-ket-qua.md) | 5 test case Integration Test với kết quả thật |

## Nguyên tắc đáng nhớ nhất rút ra từ Giai đoạn 5

1. **Đặt cờ chặn ở đúng tầng (Permission, không phải Authentication)** —
   vì Permission nhận được tham số `view`, cho phép 1 view tự "miễn trừ"
   chính nó (`ChangePasswordView` dùng `IsAuthenticated` thuần, không qua
   `HasPermission`) mà không cần danh sách ngoại lệ viết tay.
2. **Thêm field mới với `default=True` ảnh hưởng ngay cả dữ liệu cũ** —
   không chỉ áp dụng cho user tạo sau migration, mà mọi user đã tồn tại
   trước đó cũng nhận giá trị default ngay khi migrate.
3. **Lỗi gõ phím lạ (`ß`) là lớp lỗi mới** — khác hẳn lỗi logic hay lỗi
   chính tả tên biến đã gặp nhiều lần, đây là ký tự đặc biệt lẫn vào code
   do gõ nhầm tổ hợp phím, Python hiểu nhầm thành 1 statement độc lập.
4. **Quên dấu `/` cuối route + chỉ có `POST` = lỗi chỉ lộ ra khi gọi đúng
   chuẩn** — `APPEND_SLASH` của Django chỉ tự sửa cho GET, không áp dụng
   cho POST, nên lỗi này dễ "qua mặt" nếu test bằng GET hoặc dùng đúng
   path thiếu `/` khi test thay vì path chuẩn Frontend sẽ gọi.
