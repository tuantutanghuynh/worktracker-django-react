# 05 — Forgot Password & Vòng đời tài khoản (Account Lifecycle)

App `accounts` không chỉ có login — bạn còn chịu trách nhiệm toàn bộ "đời
sống" của một tài khoản: tạo mới, quên mật khẩu, đổi mật khẩu lần đầu, khóa
khi nghỉ việc. Đây là 4 luồng riêng biệt nhưng đều xoay quanh bảng `users` và
`password_resets`.

## Luồng 1 — Forgot Password

Tài liệu yêu cầu nêu rõ đây là tính năng **bắt buộc**: *"Bắt buộc phải có để
giảm tải cho Admin"* — nếu không có, mỗi lần quên mật khẩu nhân viên phải nhờ
Admin reset tay, không scale được khi công ty lớn lên.

```text
[1] User nhập email vào form "Quên mật khẩu"
       ↓
[2] FE: POST /api/auth/forgot-password/  { email }
       ↓
[3] BE: Tạo 1 token ngẫu nhiên (an toàn, không đoán được — không dùng UUID
        thường, nên dùng secrets.token_urlsafe())
       ↓
[4] BE: Lưu vào bảng password_resets: email, token, expires_at (now + 15 phút),
        is_used=False
       ↓
[5] BE: Gửi email chứa link dạng:
        https://worktracker.app/reset-password?token=<token>
        (dùng django.core.mail qua SMTP — Gmail/SendGrid)
       ↓
[6] BE: LUÔN trả 200 OK, dù email có tồn tại trong hệ thống hay không
       ↓
[7] User bấm link trong email → FE hiện form nhập mật khẩu mới
       ↓
[8] FE: POST /api/auth/reset-password/  { token, new_password }
       ↓
[9] BE kiểm tra theo thứ tự:
       - token có tồn tại trong password_resets? Không → lỗi
       - is_used = True? → lỗi "link đã được dùng"
       - expires_at < now? → lỗi "link đã hết hạn"
       ↓ (hợp lệ)
[10] BE: cập nhật password mới (hash lại), đánh dấu is_used=True
       ↓
[11] BE: trả 200, FE điều hướng về /login
```

### Vì sao bước [6] luôn trả 200 dù email không tồn tại?

Cùng lý do với *user enumeration* đã nói ở file 03: nếu API trả "email không
tồn tại trong hệ thống" cho email sai và "đã gửi email" cho email đúng, kẻ
tấn công dò ra được toàn bộ email nhân viên đang tồn tại trong công ty chỉ
bằng cách thử hàng loạt email vào form quên mật khẩu. Trả lời chung
"Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu" cho mọi trường
hợp là thực hành chuẩn.

### Vì sao token chỉ dùng 1 lần và hết hạn 15 phút?

Email là kênh không an toàn tuyệt đối (có thể bị forward, lưu trong hộp thư
nhiều năm, đồng nghiệp đọc được nếu màn hình không khóa). Giới hạn thời gian
sống ngắn (15 phút) và chỉ-dùng-1-lần (`is_used`) giảm tối đa cửa sổ thời
gian một link cũ trong email có thể bị lợi dụng.

## Luồng 2 — First Login Password Change (đổi mật khẩu lần đầu)

Theo yêu cầu (`all worktracker features-fix.docx`, mục Identity & Access
Management): *"Tạo mới tài khoản, cấp phát mật khẩu mặc định (và buộc đổi ở
lần đăng nhập đầu)"*.

Vấn đề cần giải quyết: Admin tạo account cho nhân viên mới với password mặc
định (ví dụ `Welcome@123`) — nếu không bắt đổi, rất nhiều nhân viên sẽ dùng
mãi password mặc định này, và **password mặc định coi như công khai trong
nội bộ công ty** (ai cũng đoán được pattern). Giải pháp đề xuất:

```sql
must_change_password BOOLEAN DEFAULT TRUE
```

```text
Admin tạo tài khoản (must_change_password = True theo default)
       ↓
User đăng nhập lần đầu bằng password mặc định → login thành công, có token
       ↓
FE: kiểm tra field must_change_password trong response login
       ↓ (= True)
FE: redirect cứng tới /change-password, KHÔNG cho vào Dashboard
       ↓
User đặt password mới → BE set must_change_password = False
       ↓
Từ lần sau, login bình thường vào Dashboard
```

Điểm hay nhầm: việc chặn "không cho vào Dashboard" phải làm ở cả 2 phía —
Frontend redirect (UX tốt) **và** Backend chặn các API khác nếu
`must_change_password = True` (bảo mật thật, đề phòng user tự sửa URL trên
browser để né qua trang đổi mật khẩu).

## Luồng 3 — Offboarding (Khóa tài khoản khi nghỉ việc)

Yêu cầu: *"Khóa tài khoản nhân viên lập tức (Revoke Access) mà không làm mất
lịch sử các Task và Log Work họ đã từng làm."*

Lưu ý quan trọng nằm ở nửa sau câu này: **không xóa user, chỉ khóa**. Đây
chính là lý do `is_active` tồn tại thay vì xóa dòng dữ liệu. Nếu xóa thật
(hard delete) user khỏi bảng `users`, mọi `Task.assignee_id`,
`LogWork.user_id` trỏ tới user đó sẽ vi phạm khóa ngoại (hoặc phải cascade
xóa luôn — mất sạch lịch sử công việc, lương, audit). Đây giống nguyên tắc
Soft Delete đã áp dụng cho `clients` (`is_active` flag) ở app khác trong dự
án — cùng một tư duy thiết kế, áp dụng nhất quán.

```text
Admin bấm "Khóa tài khoản" nhân viên X
       ↓
BE: UPDATE users SET is_active = False WHERE id = X
       ↓
BE: đồng thời thu hồi mọi token đang hoạt động của X
    (đẩy jti của token hiện tại — và lý tưởng là toàn bộ refresh token
    chưa hết hạn — vào Redis blacklist, xem file 02)
       ↓
Nhân viên X đang dùng app → request tiếp theo bị 401/403 ngay,
    không cần chờ token tự hết hạn 15 phút
       ↓
Toàn bộ Task/LogWork cũ của X vẫn còn nguyên trong DB, chỉ là X
    không đăng nhập được nữa
```

## Bảng tổng hợp cột liên quan tới lifecycle (đối chiếu với model đã có)

| Cột | Có trong model hiện tại? | Vai trò |
|---|---|---|
| `is_active` (CustomUser, kế thừa từ AbstractUser) | ✅ Có sẵn | Khóa/mở tài khoản |
| `must_change_password` | ❌ Chưa có trong `models.py` | Đề xuất bổ sung — bạn cần thêm field này vào `CustomUser` khi bắt đầu code |
| `password_resets.is_used`, `.expires_at` | ✅ Có sẵn | Token quên mật khẩu dùng 1 lần |

`must_change_password` là field tài liệu **đề xuất bổ sung** (ghi rõ "Đề xuất
bổ sung" trong `WorkTracker_Authentication_Guide.md`) — chưa có trong
`models.py` hiện tại. Đây là điểm bạn nên nêu ra trong buổi họp team: cần
thêm 1 field nhỏ vào model `CustomUser` trước khi code phần đổi mật khẩu lần
đầu.

## Câu hỏi tự kiểm tra

1. Nếu Admin khóa tài khoản nhân viên X nhưng quên/không thu hồi token, X có
   bị đăng xuất ngay lập tức không? Tối đa X còn dùng app được bao lâu nữa?
2. Tại sao `password_resets` lưu `email` (dạng text) thay vì FK trực tiếp tới
   `users.id`? (Gợi ý: nghĩ về trường hợp người dùng nhập email không tồn
   tại trong hệ thống ở bước [3] của luồng Forgot Password).
