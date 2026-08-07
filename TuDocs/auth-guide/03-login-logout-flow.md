# 03 — Luồng Login / Logout end-to-end

Mục tiêu file này: đi từng bước từ lúc người dùng bấm "Đăng nhập" tới lúc họ
nhìn thấy Dashboard, để bạn biết **chỗ nào là việc của Backend, chỗ nào là
việc của Frontend**, và dữ liệu đi qua những trạm nào.

## Bước 0 — Trước khi vào luồng: vì sao có bảng `users` riêng, `roles` riêng

Đây là quyết định thiết kế đã có trong `backend/accounts/models.py`
(`CustomUser`, `Role`) — bạn không cần tạo lại, nhưng cần hiểu **tại sao**:

> "Áp dụng giải pháp bóc tách Hồ sơ (Profile Separation)... Bảng `users` được
> gọt mỏng tối đa, loại bỏ hoàn toàn các trường thông tin cá nhân (như họ
> tên) nhằm đẩy tốc độ truy vấn đăng nhập lên mức cao nhất."

Khi user gõ email/password để đăng nhập, Django chỉ cần `SELECT` trên bảng
`users` (ít cột, có index trên `email`) — không cần kéo theo `full_name`,
`avatar_url`, `phone_number` (những thứ này nằm ở `EmployeeProfile`, chỉ load
khi cần hiển thị hồ sơ). Đây là tư duy "tách bảng nóng (hot) khỏi bảng nguội
(cold)" — bảng càng hay được truy vấn ở đường găng (login) thì càng phải gọn.

## Luồng Login — từng bước

```text
[1] FE: User nhập email + password vào form (react-hook-form + zod validate)
       ↓ (validate định dạng email, password không rỗng — chặn ngay trên browser)
[2] FE: POST /api/auth/login/  { email, password }
       ↓
[3] BE: Django nhận request, tra bảng users theo email
       ↓
[4] BE: Email không tồn tại?       → trả 401, KHÔNG nói rõ "email không tồn tại"
       Password sai?                → trả 401, cùng message với trường hợp trên
       is_active = False?           → trả 403 "Tài khoản đã bị khóa"
       ↓ (nếu hợp lệ)
[5] BE: SimpleJWT sinh ra Access Token (15p) + Refresh Token (7 ngày)
       Payload chứa: user_id, email, role
       ↓
[6] BE: trả về { access, refresh, user: {...} }
       ↓
[7] FE: Lưu access/refresh vào Zustand store (global state)
       ↓
[8] FE: jwt-decode đọc payload để biết role
       ↓
[9] FE: react-router-dom điều hướng theo role
       ADMIN → /admin/dashboard
       MANAGER → /manager/dashboard
       EMPLOYEE → /employee/dashboard
```

### Vì sao bước [4] không nói rõ "email không tồn tại" hay "sai password"?

Đây là một chi tiết bảo mật dễ bị bỏ qua nhưng quan trọng để bạn nói được với
team: nếu API trả lời khác nhau cho 2 trường hợp ("email không tồn tại" vs
"password sai"), một người tấn công có thể **dò ra danh sách email nào đang
tồn tại trong hệ thống** chỉ bằng cách thử nhiều email và đọc message lỗi
(gọi là *user enumeration attack*). Trả về cùng một message chung
("Email hoặc mật khẩu không đúng") cho cả 2 trường hợp là thực hành chuẩn.

### Vì sao kiểm tra `is_active` lại là bước riêng, không gộp vào "sai password"?

Vì về mặt nghiệp vụ đây là 2 tình huống khác nhau mà Frontend cần xử lý khác
nhau: "sai thông tin đăng nhập" (user tự sửa lại form) vs "tài khoản bị khóa"
(user cần liên hệ Admin, không có gì để sửa). Tài liệu thiết kế
(`DATABASE_WORKTRACKER`) đặt index trên cột `is_active` chính vì cột này được
truy vấn ở **mọi lần đăng nhập** — kiểm tra càng sớm trong luồng càng tốt
(tránh tính toán JWT cho một tài khoản sắp bị chặn).

## Luồng Logout

```text
[1] FE: User bấm "Đăng xuất"
       ↓
[2] FE: POST /api/auth/logout/  (gửi kèm Access Token hiện tại trong header)
       ↓
[3] BE: Lấy claim "jti" từ token đang dùng
       ↓
[4] BE: Redis SETEX blacklist:<jti> <thời_gian_còn_lại_của_token> "1"
       ↓
[5] BE: trả 200 OK
       ↓
[6] FE: Xóa access/refresh khỏi Zustand store + localStorage
       ↓
[7] FE: Điều hướng về /login
```

Lưu ý: bước [6]-[7] (xóa state, điều hướng) **vẫn phải làm dù bước [2]-[5]
thất bại** (ví dụ mất mạng) — không nên để user bị "kẹt" ở trang cũ chỉ vì
API logout lỗi. Đây là nguyên tắc UX: logout ở Frontend không nên phụ thuộc
100% vào phản hồi thành công của Backend.

## Bảng tổng hợp HTTP status code cho luồng login (để thảo luận với team)

| Tình huống | Status | Vì sao |
|---|---|---|
| Email/password đúng | 200 | Thành công |
| Email không tồn tại hoặc password sai | 401 | Unauthorized — chưa xác thực được danh tính |
| Tài khoản bị khóa (`is_active=False`) | 403 | Forbidden — đã biết danh tính, nhưng bị cấm |
| Thiếu field email/password trong request | 400 | Bad Request — lỗi định dạng dữ liệu gửi lên |

Phân biệt 401 vs 403 là điểm hay bị hỏi khi review code: **401 = "tôi không
biết bạn là ai"**, **403 = "tôi biết bạn là ai, nhưng bạn không được phép"**.

## Câu hỏi tự kiểm tra

1. Vì sao Access Token gửi qua header `Authorization: Bearer <token>` mà
   không gửi qua cookie như session truyền thống?
2. Nếu Frontend không gọi API logout (ví dụ tắt trình duyệt đột ngột), token
   cũ có còn dùng được không? Tới khi nào nó hết tác dụng?
