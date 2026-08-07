# Thứ tự đọc code để hiểu toàn bộ luồng dự án (tính đến 22/07/2026)

Index này liệt kê **file code thật** (không phải tài liệu hướng dẫn) theo
thứ tự nên đọc để hiểu kiến trúc + luồng chạy của toàn bộ backend/frontend
hiện tại, sau khi đã merge xong 3 nhánh (`TuanTu` + `LongNguyen` +
`MinhAnh`) trên nhánh `merge-team-integration`. Mỗi dòng có 1 câu ngắn nói
"đọc để tìm hiểu gì" — không lặp lại nội dung, chỉ định hướng.

Nếu cần giải thích sâu "vì sao" cho 1 phần cụ thể, các series
[auth-guide](auth-guide/) và [timesheet-guide](timesheet-guide/) đã có sẵn
— index này chỉ dẫn đường tới code thật, không thay thế 2 series đó.

Bỏ qua trong danh sách: file `admin.py` (đăng ký Django admin site, không
phải logic nghiệp vụ), `views.py` rỗng mặc định (`tasks/`, `timesheets/`,
`reports/` — chưa ai dùng), toàn bộ `migrations/`.

## Chương 1 — Cấu hình & bản đồ tổng (đọc trước tiên, ~10 phút)

Đọc 2 file này trước để có bản đồ tổng thể trước khi đi vào chi tiết từng app.

| # | File | Đọc để tìm hiểu gì |
|---|------|---------------------|
| 1 | [backend/worktracker_core/settings.py](../backend/worktracker_core/settings.py) | App nào được cài (`INSTALLED_APPS`), auth dùng class nào, JWT/Redis/CORS cấu hình ra sao |
| 2 | [backend/worktracker_core/urls.py](../backend/worktracker_core/urls.py) | Toàn bộ bề mặt API — prefix nào thuộc role nào (`api/auth`, `api/admin`, `api/manager`, `api/timesheets`) |

## Chương 2 — Xác thực & phân quyền (`accounts` — nền tảng mọi app khác dùng)

Đọc theo đúng thứ tự request thật đi qua: model trước, permission/auth
middleware kế tiếp, rồi theo 1 luồng cụ thể (Login) từ đầu tới cuối.

| # | File | Đọc để tìm hiểu gì |
|---|------|---------------------|
| 3 | [backend/accounts/models.py](../backend/accounts/models.py) | 7 bảng gốc: `Role`, `Permission`, `RolePermission`, `CustomUser` (+ `CustomUserManager`), `PasswordReset`, `Department`, `EmployeeProfile` |
| 4 | [backend/accounts/permissions.py](../backend/accounts/permissions.py) | `HasPermission` — engine RBAC dùng chung toàn hệ thống (trừ code của Long) |
| 5 | [backend/accounts/authentication.py](../backend/accounts/authentication.py) | `WorkTrackerJWTAuthentication` — blacklist logout + cache `is_active`, class auth chính trong `settings.py` |
| 6 | [backend/accounts/redis_client.py](../backend/accounts/redis_client.py) | Kết nối Redis dùng riêng cho blacklist (khác `CACHES` của Django) |
| 7 | [backend/accounts/serializers_auth.py](../backend/accounts/serializers_auth.py) | Logic thật của Login/Forgot/Reset/Change Password (`LoginSerializer.get_tokens()` là nơi sinh JWT) |
| 8 | [backend/accounts/views_auth.py](../backend/accounts/views_auth.py) | View mỏng, wire request/response cho serializer ở trên |
| 9 | [backend/accounts/urls_auth.py](../backend/accounts/urls_auth.py) | Route `login/refresh/logout/forgot-password/reset-password/change-password` |
| 10 | [backend/accounts/serializers_admin.py](../backend/accounts/serializers_admin.py) | Serializer cho quản lý User/Role/Permission/Department (phía Admin) |
| 11 | [backend/accounts/views_admin.py](../backend/accounts/views_admin.py) | `UserViewSet`/`RoleViewSet`/`PermissionViewSet`/`DepartmentViewSet` + `AdminDisableUserView` |
| 12 | [backend/accounts/urls_admin.py](../backend/accounts/urls_admin.py) | Router cho các ViewSet trên |
| 13 | [backend/accounts/views_manager.py](../backend/accounts/views_manager.py) | `ManagerTeamEmployeeListView` — Manager xem danh sách nhân viên team mình |
| 14 | [backend/accounts/urls_manager.py](../backend/accounts/urls_manager.py) | Route tương ứng |

`accounts/urls.py`, `accounts/views.py` cố tình để rỗng (quy ước tách file
theo role) — không cần đọc.

## Chương 3 — Dữ liệu nghiệp vụ cốt lõi (`projects`, `tasks` — chỉ đọc model)

Chỉ cần đọc **model** ở bước này để có đủ từ vựng (`Client`, `Job`,
`Task`...) cho Chương 4-5 — chưa cần đọc view/serializer của 2 app này vội,
vì đó là code do Long/Minh Anh viết cho vai trò của họ.

| # | File | Đọc để tìm hiểu gì |
|---|------|---------------------|
| 15 | [backend/projects/models.py](../backend/projects/models.py) | `Client`, `Job` — `Job.manager_id` là nơi thật sự tính "phạm vi của Manager" (khác `departments.manager_id`, xem comment trong `accounts/models.py`) |
| 16 | [backend/tasks/models.py](../backend/tasks/models.py) | `Task` và các bảng liên quan — mỗi `Task` thuộc 1 `Job` |

## Chương 4 — `timesheets` (phần bạn sở hữu — đọc kỹ nhất)

| # | File | Đọc để tìm hiểu gì |
|---|------|---------------------|
| 17 | [backend/timesheets/models.py](../backend/timesheets/models.py) | `TimeLock` (GLOBAL/JOB scope), `LogWork` (review + adjust workflow), `DailyUserTimesheet` |
| 18 | [backend/timesheets/serializers_employee.py](../backend/timesheets/serializers_employee.py) | `EmployeeLogWorkSerializer.create()` — Data Isolation + Time Lock (2 lớp) + 24h Cap, toàn bộ trong `transaction.atomic()` |
| 19 | [backend/timesheets/views_employee.py](../backend/timesheets/views_employee.py) | `EmployeeLogWorkView` (tạo), `EmployeeVoidLogWorkView` (void, mới hôm 22/07) |
| 20 | [backend/timesheets/urls_employee.py](../backend/timesheets/urls_employee.py) | Route `log-works/` + `log-works/<id>/void/` |
| 21 | [backend/timesheets/services/daily_total_manager_service.py](../backend/timesheets/services/daily_total_manager_service.py) | `rebuild_daily_user_timesheet()`, `calculate_user_day_total()` — dùng lại ở cả Employee lẫn Manager |
| 22 | [backend/timesheets/services/timelock_manager_service.py](../backend/timesheets/services/timelock_manager_service.py) | Logic khoá/mở kỳ báo cáo (giờ hoàn toàn do Long viết + sở hữu) |
| 23 | [backend/timesheets/services/logwork_review_manager_service.py](../backend/timesheets/services/logwork_review_manager_service.py) | approve/reject/correct/void của Manager — đọc để biết `notify()` sẽ được gọi ở đâu (FR-72) |
| 24 | [backend/timesheets/serializers_manager.py](../backend/timesheets/serializers_manager.py) | Serializer phía Manager |
| 25 | [backend/timesheets/views_manager.py](../backend/timesheets/views_manager.py) | `ManagerLogWorkViewSet`, `ManagerTimeLockViewSet` |
| 26 | [backend/timesheets/urls_manager.py](../backend/timesheets/urls_manager.py) | Router tương ứng |
| 27 | [backend/timesheets/filters_manager.py](../backend/timesheets/filters_manager.py) | Filter theo employee/date range cho trang Review |

Đối chiếu song song với [timesheet-guide/giai-doan-1-log](timesheet-guide/giai-doan-1-log/)
→ [giai-doan-4-log](timesheet-guide/giai-doan-4-log/) để hiểu **vì sao**
code viết như vậy, không chỉ đọc code suông.

## Chương 5 — `system` (Audit Log, Notification, RBAC dùng chung của Manager)

| # | File | Đọc để tìm hiểu gì |
|---|------|---------------------|
| 28 | [backend/system/models.py](../backend/system/models.py) | `AuditLog`, `Notification` (có `EventType`, `ChannelType`) |
| 29 | [backend/system/utils.py](../backend/system/utils.py) | `log_audit_event()` — helper đơn giản, Minh Anh dùng |
| 30 | [backend/system/services/audit_manager_service.py](../backend/system/services/audit_manager_service.py) | `log_action()` + `snapshot()` — helper có chụp trước/sau, Long dùng (mình cũng dùng lại cho `timesheets`) |
| 31 | [backend/system/services/notification_manager_service.py](../backend/system/services/notification_manager_service.py) | `notify()` — hàm dùng chung tạo notification, có `validate_event_type()` |
| 32 | [backend/system/permissions_manager.py](../backend/system/permissions_manager.py) | RBAC riêng của Long: `IsActiveAuthenticated`, `IsManagerRole`, `HasPermissionCode` (⚠️ trùng tên nhưng khác hẳn `accounts.permissions.HasPermission`, xem giai-doan-4-log nếu cần lý do) |
| 33 | [backend/system/scoping_manager.py](../backend/system/scoping_manager.py) | Helper giới hạn queryset theo phạm vi Manager |
| 34 | [backend/system/serializers_admin.py](../backend/system/serializers_admin.py) | Serializer cho `AuditLog` |
| 35 | [backend/system/views_admin.py](../backend/system/views_admin.py) | `AuditLogViewSet` (chỉ đọc) + `DashboardView` (thống kê tổng) |
| 36 | [backend/system/urls_admin.py](../backend/system/urls_admin.py) | Route tương ứng |

## Chương 6 — Lớp Manager/Admin theo từng app nghiệp vụ (đọc lướt, không cần thuộc)

Đây là code Long/Minh Anh viết cho vai trò Manager quản lý Client/Job/Task/
Report — chỉ cần đọc lướt để biết API nào tồn tại, không cần hiểu sâu từng
dòng trừ khi cần tích hợp trực tiếp.

| # | File | Ghi chú |
|---|------|---------|
| 37 | [backend/projects/views_admin.py](../backend/projects/views_admin.py) | `ClientViewSet`, `JobViewSet` (Admin) |
| 38 | [backend/projects/views_manager.py](../backend/projects/views_manager.py) | `ManagerJobViewSet` |
| 39 | [backend/tasks/views_manager.py](../backend/tasks/views_manager.py) | CRUD + chuyển trạng thái Task |
| 40 | [backend/tasks/services/task_transition_manager_service.py](../backend/tasks/services/task_transition_manager_service.py) | Validate chuyển trạng thái Kanban (liên quan FR-39, phần Frontend của bạn sẽ cần biết) |
| 41 | [backend/reports/views_manager.py](../backend/reports/views_manager.py) | Dashboard, export báo cáo (PDF/Excel) |

## Chương 7 — Frontend (mới có phần Auth)

| # | File | Đọc để tìm hiểu gì |
|---|------|---------------------|
| 42 | [frontend/src/main.jsx](../frontend/src/main.jsx) | Entry point |
| 43 | [frontend/src/router/index.jsx](../frontend/src/router/index.jsx) | Khai báo route + gắn `ProtectedRoute`/`RoleRoute` |
| 44 | [frontend/src/stores/authStore.js](../frontend/src/stores/authStore.js) | Zustand store: `accessToken`/`refreshToken`/`user` |
| 45 | [frontend/src/api/axiosClient.js](../frontend/src/api/axiosClient.js) | Axios instance + interceptor tự refresh token khi 401 |
| 46 | [frontend/src/api/authApi.js](../frontend/src/api/authApi.js) | Gọi API auth thật |
| 47 | [frontend/src/components/auth/ProtectedRoute.jsx](../frontend/src/components/auth/ProtectedRoute.jsx) | Chặn route khi chưa đăng nhập |
| 48 | [frontend/src/components/auth/RoleRoute.jsx](../frontend/src/components/auth/RoleRoute.jsx) | Chặn route theo role |
| 49 | [frontend/src/components/auth/PermissionRoute.jsx](../frontend/src/components/auth/PermissionRoute.jsx) | Chặn route theo permission code |
| 50 | [frontend/src/components/auth/LoginPage.jsx](../frontend/src/components/auth/LoginPage.jsx) | Trang Login thật |
| 51 | [frontend/src/hooks/useLogin.js](../frontend/src/hooks/useLogin.js) | Hook xử lý logic Login |
| 52 | [frontend/src/components/auth/ChangePasswordPage.jsx](../frontend/src/components/auth/ChangePasswordPage.jsx) + [useChangePassword.js](../frontend/src/hooks/useChangePassword.js) | Trang + hook đổi mật khẩu |
| 53 | [frontend/src/components/auth/ForgotPasswordPage.jsx](../frontend/src/components/auth/ForgotPasswordPage.jsx) + [useForgotPassword.js](../frontend/src/hooks/useForgotPassword.js) | Trang + hook quên mật khẩu |
| 54 | [frontend/src/components/auth/ResetPasswordPage.jsx](../frontend/src/components/auth/ResetPasswordPage.jsx) + [useResetPassword.js](../frontend/src/hooks/useResetPassword.js) | Trang + hook đặt lại mật khẩu |

Chưa có: layout Employee, My Tasks, Log Work form, Personal Dashboard,
Notification Center — vì backend tương ứng cũng chưa xong hết (xem
`project-roadmap/03-phase-tuan-tu-auth-employee.md`).

## Sau khi đọc xong

Quay lại `TuDocs/timesheet-guide/giai-doan-4-log/00-tong-quan.md` để nối
tiếp đúng chỗ đang dừng (Phase 3 — API notification, đã có code đề xuất,
chưa áp dụng).
