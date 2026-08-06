from rest_framework.routers import DefaultRouter
from .views import UserViewSet, RoleViewSet, PermissionViewSet, DepartmentViewSet

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
# PATCH  /api/auth/users/{id}/assign-department/  → Gán user vào phòng ban qua EmployeeProfile
router.register('users', UserViewSet, basename='user')

# ── ROLES ─────────────────────────────────────────────────────────────────────
# GET    /api/auth/roles/                         → Danh sách role (quyền: role:manage)
# POST   /api/auth/roles/                         → Tạo role mới + ghi audit (quyền: role:manage)
# GET    /api/auth/roles/{id}/                    → Chi tiết 1 role
# PUT    /api/auth/roles/{id}/                    → Cập nhật toàn bộ role + ghi audit (quyền: role:manage)
# PATCH  /api/auth/roles/{id}/                    → Cập nhật một phần role (quyền: role:manage)
# DELETE /api/auth/roles/{id}/                    → Xóa role
# POST   /api/auth/roles/{id}/assign-permissions/ → Gán danh sách permission cho role + ghi audit
router.register('roles', RoleViewSet, basename='role')

# ── PERMISSIONS ───────────────────────────────────────────────────────────────
# GET /api/auth/permissions/        → Danh sách tất cả permissions trong hệ thống (chỉ đọc, quyền: role:manage)
# GET /api/auth/permissions/{id}/   → Chi tiết 1 permission
router.register('permissions', PermissionViewSet, basename='permission')

# ── DEPARTMENTS ───────────────────────────────────────────────────────────────
# GET    /api/auth/departments/       → Danh sách phòng ban (kèm thông tin manager)
# POST   /api/auth/departments/       → Tạo phòng ban mới (quyền: department:create)
# GET    /api/auth/departments/{id}/  → Chi tiết 1 phòng ban
# PUT    /api/auth/departments/{id}/  → Cập nhật toàn bộ (quyền: department:update)
# PATCH  /api/auth/departments/{id}/  → Cập nhật một phần (quyền: department:update)
# DELETE /api/auth/departments/{id}/  → Xóa phòng ban
router.register('departments', DepartmentViewSet, basename='department')

urlpatterns = router.urls
