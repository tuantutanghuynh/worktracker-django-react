# 04 — Testing & Kết quả thực tế

## Dữ liệu test đã chuẩn bị

```text
admin@worktracker.com      — role ADMIN
manager@worktracker.com    — role MANAGER, quản lý phòng "Phong Ky Thuat"
employee@worktracker.com   — role EMPLOYEE, thuộc phòng "Phong Ky Thuat"
```

## 4 test case

### Test 1 — ADMIN gọi `AdminDisableUserView` trên `employee`

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://127.0.0.1:8000/api/auth/user/<id>/disable/" \
  -H "Authorization: Bearer <admin_access_token>"
```

```text
{"detail":"User disabled"}
HTTP_STATUS:200
```

✅ Đúng kỳ vọng.

### Test 2 — User thiếu quyền `user:disable` gọi `AdminDisableUserView`

**Lần thử đầu tiên (kết quả gây hiểu lầm)**: dùng lại token của
`employee@worktracker.com` — nhưng tài khoản này **vừa bị Test 1 disable
xong**. Kết quả:

```text
{"detail":"User is inactive","code":"user_inactive"}
HTTP_STATUS:401
```

Không phải lỗi — đây là `JWTAuthentication` tự chặn tài khoản
`is_active=False` **trước khi** request đi tới được bước kiểm tra
`HasPermission`. Test này vô tình đổi đối tượng đang kiểm tra (từ "thiếu
quyền" thành "tài khoản bị khóa") — xem mục "Phát hiện phụ" ở cuối file.

**Lần thử lại, đúng mục tiêu**: dùng token của `manager@worktracker.com`
(còn active, nhưng không có quyền `user:disable` trong `role_permissions`):

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://127.0.0.1:8000/api/auth/user/<id>/disable/" \
  -H "Authorization: Bearer <manager_access_token>"
```

```text
{"detail":"You do not have permission to perform this action."}
HTTP_STATUS:403
```

✅ Đúng kỳ vọng.

### Test 3 — MANAGER gọi `ManagerTeamEmployeeListView`

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://127.0.0.1:8000/api/auth/team/employees/" \
  -H "Authorization: Bearer <manager_access_token>"
```

```text
[{"id":3,"full_name":"Nguyen Van A","department":"Phong Ky Thuat"}]
HTTP_STATUS:200
```

✅ Đúng kỳ vọng — chỉ trả về đúng nhân viên thuộc phòng ban manager này
quản lý.

### Test 4 — ADMIN (thiếu `employee:view_team`) gọi `ManagerTeamEmployeeListView`

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://127.0.0.1:8000/api/auth/team/employees/" \
  -H "Authorization: Bearer <admin_access_token>"
```

```text
{"detail":"You do not have permission to perform this action."}
HTTP_STATUS:403
```

✅ Đúng kỳ vọng — `employee:view_team` chỉ gán cho MANAGER (migration
`0003`), ADMIN không có quyền này nên bị chặn, dù ADMIN có quyền cao hơn
ở những việc khác.

## Bảng tổng hợp

| # | Trường hợp | Kỳ vọng | Thực tế |
|---|---|---|---|
| 1 | ADMIN disable user | 200 | ✅ |
| 2 | MANAGER (thiếu quyền) disable user | 403 | ✅ (sau khi sửa lại đối tượng test) |
| 3 | MANAGER xem team mình | 200, đúng 1 nhân viên | ✅ |
| 4 | ADMIN (thiếu quyền) xem team | 403 | ✅ |

**Giai đoạn 3 (RBAC) hoàn tất** — 4/4 test case đúng kỳ vọng.

## Phát hiện phụ: thứ tự Authentication → Authorization quan trọng thế nào

Test 2 (lần đầu) vô tình minh chứng một thứ rất đáng nhớ: **tài khoản bị
khóa (`is_active=False`) không bao giờ tới được bước kiểm tra
Permission** — `JWTAuthentication` (cụ thể là `BlacklistAwareJWTAuthentication`
kế thừa nó) đã tự kiểm tra `is_active` và chặn ngay bằng `401` trong quá
trình xác thực, trước khi DRF kịp gọi tới `HasPermission.has_permission()`.

Sơ đồ pipeline xử lý 1 request được xác nhận lại bằng thực nghiệm:

```text
Request đến
   ↓
[Authentication] BlacklistAwareJWTAuthentication
   - Token hợp lệ? Không → 401
   - Token bị blacklist (đã logout)? Có → 401
   - User.is_active = False? Có → 401   ← tài khoản bị khóa CHẶN Ở ĐÂY
   ↓ (qua được hết, request.user đã xác định)
[Authorization] HasPermission.has_permission()
   - Có required_permission trong role_permissions? Không → 403
   ↓ (qua được)
View.post() / View.get() — logic nghiệp vụ thật chạy ở đây
```

Hệ quả thực tế đáng nói với team: tính năng "Offboarding" (khóa tài khoản
nhân viên nghỉ việc) **đã hoạt động đúng ngay cả ở những API hoàn toàn mới
viết sau này** (như 2 API ở Giai đoạn 3) — mà không cần code thêm gì riêng
cho việc đó ở từng View. Đây là lợi ích của việc đặt logic "tài khoản có
hợp lệ không" ở đúng tầng Authentication (chạy cho MỌI request) thay vì
lặp lại kiểm tra đó ở từng View riêng lẻ.
