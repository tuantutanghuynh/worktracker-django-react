from rest_framework.routers import DefaultRouter
from .views import UserViewSet, RoleViewSet, DepartmentViewSet

router = DefaultRouter()

# ── USERS ─────────────────────────────────────────────────────────────────────
# GET    /api/auth/users/                         → Danh sách user (filter: ?email=, ?role=, ?department=, ?is_active=)
# POST   /api/auth/users/                         → Tạo user mới, auto-tạo EmployeeProfile (quyền: user:create)
# GET    /api/auth/users/{id}/                    → Chi tiết 1 user (kèm role + profile)
# PUT    /api/auth/users/{id}/                    → Cập nhật toàn bộ user (quyền: user:update)
# PATCH  /api/auth/users/{id}/                    → Cập nhật một phần user (quyền: user:update)
# DELETE /api/auth/users/{id}/                    → Xóa mềm: is_active=False + xóa cache Redis
# PATCH  /api/auth/users/{id}/lock/               → Khóa tài khoản: is_active=False + xóa cache Redis
# PATCH  /api/auth/users/{id}/unlock/             → Mở khóa: is_active=True + cập nhật cache Redis
# PATCH  /api/auth/users/{id}/reset-password/     → Đặt lại mật khẩu, ép must_change_password=True (quyền: user:reset_password)
# PATCH  /api/auth/users/{id}/assign-department/  → Gán user vào phòng ban qua EmployeeProfile
router.register('users', UserViewSet, basename='user')

# ── ROLES ─────────────────────────────────────────────────────────────────────
# GET /api/auth/roles/       → Danh sách 3 role cố định, chỉ đọc — dùng để đổ
#                              dropdown chọn role lúc tạo/sửa user (quyền: user:view)
# GET /api/auth/roles/{id}/  → Chi tiết 1 role
router.register('roles', RoleViewSet, basename='role')

# ── DEPARTMENTS ───────────────────────────────────────────────────────────────
# GET    /api/auth/departments/       → Danh sách phòng ban (kèm thông tin manager)
# POST   /api/auth/departments/       → Tạo phòng ban mới (quyền: department:create)
# GET    /api/auth/departments/{id}/  → Chi tiết 1 phòng ban
# PUT    /api/auth/departments/{id}/  → Cập nhật toàn bộ (quyền: department:update)
# PATCH  /api/auth/departments/{id}/  → Cập nhật một phần (quyền: department:update)
# DELETE /api/auth/departments/{id}/  → Xóa phòng ban
router.register('departments', DepartmentViewSet, basename='department')

urlpatterns = router.urls
