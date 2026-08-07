# Auth Guide — Lộ trình tư duy trước khi viết code

Series này dành cho Tuấn Tú (phụ trách app `accounts`: đăng nhập, phân quyền,
quên mật khẩu, CRUD user/department) trong dự án WorkTracker (React Vite +
Django REST Framework).

Mục tiêu **không phải để code ngay**. Mục tiêu là:

1. Hiểu đúng bản chất từng khái niệm (không học vẹt thuật ngữ).
2. Biết tài liệu yêu cầu đang đòi hỏi cái gì, ở đâu.
3. Có thể đứng trước team giải thích mạch lạc "tôi sẽ làm X vì Y" — không
   phải "tôi copy đoạn code này trên mạng".

## Thứ tự đọc

| # | File | Trả lời câu hỏi |
|---|------|------------------|
| 1 | [01-mental-model.md](01-mental-model.md) | Authentication vs Authorization là gì, vì sao hệ thống này cần JWT mà không cần Session truyền thống? |
| 2 | [02-jwt-and-tokens.md](02-jwt-and-tokens.md) | JWT thực chất là gì, Access/Refresh Token khác nhau ra sao, "rotation" và "blacklist" giải quyết vấn đề gì? |
| 3 | [03-login-logout-flow.md](03-login-logout-flow.md) | Đăng nhập/đăng xuất đi qua những bước nào, từ lúc bấm nút tới lúc vào Dashboard? |
| 4 | [04-rbac-and-data-isolation.md](04-rbac-and-data-isolation.md) | Tại sao chỉ có Role là không đủ? RBAC và "Data Isolation" hoạt động thế nào trong DRF? |
| 5 | [05-forgot-password-and-account-lifecycle.md](05-forgot-password-and-account-lifecycle.md) | Quên mật khẩu, đổi mật khẩu lần đầu, khóa tài khoản khi nghỉ việc — từng luồng cụ thể ra sao? |
| 6 | [06-security-and-audit.md](06-security-and-audit.md) | Những lỗi bảo mật hay gặp khi làm auth, và audit log nên ghi gì? |
| 7 | [07-frontend-architecture.md](07-frontend-architecture.md) | Phía React tổ chức ProtectedRoute, RoleRoute, Zustand store, axios interceptor như thế nào? |
| 8 | [08-roadmap-and-talking-points.md](08-roadmap-and-talking-points.md) | Tổng hợp checklist, thứ tự code hợp lý, và script để trình bày với team. |

## Nguồn tài liệu đã đối chiếu

- `docs/WorkTracker_Authentication_Guide.md` — yêu cầu kỹ thuật chi tiết về auth.
- `docs/all worktracker features-fix.docx` — yêu cầu tính năng theo từng vai trò (Admin/Manager/Employee).
- `docs/DATABASE_WORKTRACKER (FIXED).docx` — thiết kế 18 bảng nghiệp vụ, trong đó Group 1 (`roles`, `permissions`, `role_permissions`, `users`, `password_resets`) thuộc phạm vi của bạn.
- `backend/accounts/models.py` — đã viết xong 7 model (`Role`, `Permission`, `RolePermission`, `CustomUser`, `PasswordReset`, `Department`, `EmployeeProfile`). Đây là nền, series này giải thích **API và logic sẽ xây trên nền đó**.

## Lưu ý

Các file này không chứa code implementation đầy đủ — chỉ có pseudocode/đoạn
minh họa ngắn để bạn hiểu ý tưởng. Khi bạn đã nắm chắc và sẵn sàng, quay lại
nhờ tôi triển khai code thật theo từng bước trong roadmap ở file 08.
