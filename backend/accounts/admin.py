from django.contrib import admin
from .models import CustomUser, Department, EmployeeProfile, PasswordReset, Permission, Role, RolePermission


# Quản lý danh mục Vai trò trong hệ thống (ADMIN, MANAGER, EMPLOYEE).
# list_display: các cột hiển thị trong trang danh sách.
# search_fields: các trường được tìm kiếm khi gõ vào ô Search.
@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'name')
    search_fields = ('code', 'name')


# Quản lý danh mục Quyền hành động (vd: client:create, task:assign).
# Mỗi Permission là một hành động cụ thể có thể gán cho Role.
@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'name')
    search_fields = ('code', 'name')


# Quản lý liên kết giữa Vai trò và Quyền (bảng trung gian nhiều-nhiều).
# list_filter: bộ lọc nhanh ở thanh bên phải trang, lọc theo vai trò.
@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'role', 'permission')
    list_filter = ('role',)


# Quản lý tài khoản người dùng.
# Lưu ý: field 'username' đã bị xóa khỏi model (username = None),
# thay vào đó dùng 'email' làm định danh đăng nhập.
# list_filter: lọc theo vai trò, trạng thái hoạt động, quyền staff.
@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email',)


# Quản lý token đặt lại mật khẩu (dành cho chức năng Quên mật khẩu).
# is_used: True = token đã dùng rồi (không dùng lại được).
# expires_at: thời điểm token hết hiệu lực.
@admin.register(PasswordReset)
class PasswordResetAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'is_used', 'expires_at', 'created_at')
    search_fields = ('email',)


# Quản lý danh mục Phòng ban / Đội nhóm.
# manager: nhân viên đứng đầu phòng ban (chỉ mang tính tổ chức,
# không dùng để kiểm tra phạm vi quyền truy cập trong hệ thống).
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'manager')
    search_fields = ('name',)


# Quản lý hồ sơ cá nhân của nhân viên.
# Mỗi EmployeeProfile gắn 1-1 với một CustomUser (user là khóa chính).
# Lưu thông tin bổ sung: tên đầy đủ, số điện thoại, phòng ban.
@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'phone_number', 'department')
    search_fields = ('full_name', 'phone_number')
