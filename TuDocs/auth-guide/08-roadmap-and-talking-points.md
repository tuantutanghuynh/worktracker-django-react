# 08 — Roadmap triển khai & Script trình bày với team

## Trạng thái hiện tại (đã đối chiếu với code thật trong repo)

| Thành phần | Trạng thái |
|---|---|
| Models (`Role`, `Permission`, `RolePermission`, `CustomUser`, `PasswordReset`, `Department`, `EmployeeProfile`) | ✅ Đã viết xong trong `backend/accounts/models.py` |
| Migration đã chạy vào Postgres | ✅ Đã xong (27 bảng, bao gồm 7 bảng của `accounts`) |
| `djangorestframework-simplejwt` cài đặt | ✅ Đã cài |
| Cấu hình `SIMPLE_JWT` trong `settings.py` | ❌ Chưa có |
| Cấu hình `REST_FRAMEWORK` (DEFAULT_AUTHENTICATION_CLASSES) | ❌ Chưa có |
| `serializers.py` | ❌ Chưa tạo |
| `views.py` (hiện tại trống) | ❌ Chưa viết |
| `urls.py` (hiện tại chưa tồn tại trong app) | ❌ Chưa tạo |
| Redis (cho blacklist token) | ❌ Chưa cài/cấu hình |
| Field `must_change_password`, `failed_login_count`, `locked_until` | ❌ Chưa có trong model — cần bổ sung nếu làm các tính năng nâng cao |
| Frontend (React): ProtectedRoute, Zustand store, axios interceptor | ❌ Chưa bắt đầu |

## Thứ tự code hợp lý (roadmap)

Nguyên tắc sắp thứ tự: **làm cái gì cần để "test được bằng tay" sớm nhất**,
rồi mới đắp thêm các lớp bảo vệ nâng cao lên trên.

```text
Giai đoạn 1 — Khung xương tối thiểu để login được
  1. Cấu hình SIMPLE_JWT + REST_FRAMEWORK trong settings.py
  2. Viết serializer cho Login (email + password → access + refresh)
  3. Viết view Login, Refresh (dùng view có sẵn của SimpleJWT là đủ cho refresh)
  4. urls.py: /api/auth/login/, /api/auth/refresh/
  5. Test bằng Postman: login → nhận token → gọi 1 API cần xác thực

Giai đoạn 2 — Logout & Blacklist
  6. Cài + cấu hình Redis (django-redis hoặc redis-py thuần)
  7. Viết view Logout: lấy jti, SETEX vào Redis
  8. Viết Custom Authentication class: trước khi tin token, check jti
     có trong blacklist Redis không
  9. Test: login → logout → dùng lại token cũ → phải bị từ chối

Giai đoạn 3 — RBAC
  10. Tạo data mẫu cho roles/permissions/role_permissions (qua Django Admin
      hoặc fixture) theo đúng danh sách ở file 04
  11. Viết Permission class kiểm tra theo role_permissions
  12. Áp dụng Permission class + filter Data Isolation cho 1-2 API mẫu
      (để team khác tham khảo cách làm)

Giai đoạn 4 — Forgot Password
  13. Serializer + view cho forgot-password (sinh token, gửi email)
  14. Cấu hình SMTP (EMAIL_BACKEND) — môi trường dev dùng console backend
      để xem email in ra terminal, không cần SMTP thật lúc test
  15. Serializer + view cho reset-password (verify token, đổi password)

Giai đoạn 5 — Account Lifecycle
  16. Thêm field must_change_password vào CustomUser, migrate
  17. Logic chặn API khi must_change_password=True (trừ API đổi password)
  18. API Admin: tạo user mới, khóa/mở user (kèm thu hồi token khi khóa)

Giai đoạn 6 — Audit & nâng cao (làm sau khi 1-5 chạy ổn)
  19. Ghi audit log cho LOGIN_SUCCESS/FAILED/LOGOUT/PASSWORD_CHANGED
  20. (Tuỳ thời gian) Rate limiting, Account Locking, Session Management
```

Giai đoạn 1-4 là phần **bắt buộc** theo checklist của tài liệu yêu cầu. Giai
đoạn 6 phần "Nâng cao" có thể bàn với team về deadline để quyết định làm tới
đâu.

## Script gợi ý khi trình bày với team

Khi present, đi theo cấu trúc: **Vấn đề → Quyết định → Vì sao**, không chỉ
liệt kê công nghệ. Gợi ý:

> "Phần accounts của em xử lý 3 việc chính: xác thực (biết user là ai),
> phân quyền (user được làm gì), và vòng đời tài khoản (tạo/khóa/quên mật
> khẩu).
>
> Về xác thực, em dùng JWT vì hệ thống mình là React SPA gọi API thuần, không
> cần Django render HTML — JWT cho phép Backend không cần tra DB mỗi request
> để biết ai đang gọi. Đánh đổi là JWT không tự hủy được giữa đường, nên khi
> logout hoặc khi Admin khóa tài khoản, mình cần một blacklist — và theo
> đúng yêu cầu, blacklist này nằm ở Redis (không phải Postgres) để tra cứu
> nhanh O(1) và tự dọn dẹp khi token hết hạn.
>
> Về phân quyền, em không hardcode role trong code mà dùng 2 bảng
> `permissions` và `role_permissions` — vì sau này khi nghiệp vụ đổi (thêm
> quyền mới cho 1 role), mình chỉ cần sửa dữ liệu, không cần sửa code & deploy
> lại. Ngoài ra, có quyền làm hành động X không đồng nghĩa với thấy được TẤT
> CẢ dữ liệu X — ví dụ Manager chỉ thấy Job của mình — nên mọi API list/detail
> đều phải filter theo `request.user`, không tin Frontend ẩn nút là đủ.
>
> Về vòng đời tài khoản, khi Admin khóa 1 nhân viên, mình set `is_active =
> False` (không xóa, để giữ lịch sử Task/LogWork của họ) và đồng thời thu hồi
> token hiện tại của họ qua cùng cơ chế blacklist ở trên — nên họ bị đăng xuất
> ngay, không phải chờ token tự hết hạn."

Đoạn script trên cho thấy bạn hiểu **lý do**, không chỉ liệt kê thư viện —
đây là điều khiến team/giảng viên tin tưởng vào phần việc của bạn.

## Checklist tổng hợp (copy từ tài liệu yêu cầu, để track tiến độ)

### Bắt buộc
- [ ] JWT Access/Refresh Token
- [ ] Refresh Rotation
- [ ] Redis Blacklist Logout
- [ ] Forgot Password
- [ ] Change Password First Login
- [ ] RBAC (Role + Permission)
- [ ] Protected Route React
- [ ] Data Isolation
- [ ] Audit Log
- [ ] Account Disable (Offboarding)

### Nâng cao (tuỳ thời gian còn lại)
- [ ] Login Rate Limit
- [ ] Account Locking
- [ ] Session Management (`user_sessions`, logout all devices)
- [ ] 2FA

## Bước tiếp theo

Khi bạn đã đọc hết 8 file và trả lời được các câu hỏi tự kiểm tra ở cuối mỗi
file, quay lại nhờ tôi triển khai code thật theo đúng thứ tự ở "Giai đoạn 1"
— bắt đầu từ cấu hình `SIMPLE_JWT` và API Login.
