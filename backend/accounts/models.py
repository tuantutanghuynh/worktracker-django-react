from django.contrib.auth.models import AbstractUser
from django.db import models


# BẢNG 1: roles (Danh mục Vai trò)
class Role(models.Model):
    code = models.CharField(
        max_length=50, unique=True, db_index=True
    )  # Mã vai trò backend (ADMIN, MANAGER, EMPLOYEE)
    name = models.CharField(
        max_length=100
    )  # Tên hiển thị UI (Quản trị viên, Quản lý dự án...)
    description = models.CharField(
        max_length=255, blank=True, null=True
    )  # Mô tả chi tiết quyền hạn

    def __str__(self):
        return self.name


# BẢNG 2: permissions (Danh mục Quyền hạn chi tiết)
class Permission(models.Model):
    code = models.CharField(
        max_length=100, unique=True, db_index=True
    )  # Mã hành động API (client:create, task:assign...)
    name = models.CharField(max_length=150)  # Tên giải nghĩa của quyền

    def __str__(self):
        return self.code


# BẢNG 3: role_permissions (Bảng trung gian liên kết Nhiều - Nhiều giữa Vai trò và Quyền)
class RolePermission(models.Model):
    role = models.ForeignKey(
        Role, on_delete=models.CASCADE
    )  # Xóa vai trò thì tự động xóa liên kết quyền
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE
    )  # Xóa quyền thì tự động xóa liên kết vai trò

    class Meta:
        # Thiết lập ràng buộc Unique để triệt tiêu rủi ro trùng lặp cấu hình (Thay thế khóa chính phức hợp trong Django)
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"], name="unique_role_permission"
            )
        ]


# BẢNG 4: users (Tài khoản người dùng - Phiên bản gọt mỏng tối ưu)
class CustomUser(AbstractUser):
    # Loại bỏ trường không cần thiết của Django mặc định để tăng tốc độ truy vấn đăng nhập
    first_name = None
    last_name = None

    # Sử dụng email làm tài khoản đăng nhập chính, bắt buộc đánh chỉ mục (INDEX)
    email = models.EmailField(max_length=155, unique=True, db_index=True)
    role = models.ForeignKey(Role, on_delete=models.RESTRICT, null=True)  # Khóa ngoại xác định thẩm quyền cốt lõi

    # Trường is_active đã được định nghĩa sẵn trong AbstractUser với cơ chế chuyển FALSE khi nghỉ việc

    USERNAME_FIELD = "email"  # Chỉ định Django dùng email để đăng nhập thay vì username
    REQUIRED_FIELDS = ["username"]  # Các trường bắt buộc khi tạo superuser qua lệnh

    def __str__(self):
        return self.email


# BẢNG 5: password_resets (Quản lý Token Quên mật khẩu)
class PasswordReset(models.Model):
    email = models.CharField(
        max_length=155, db_index=True
    )  # Khóa tìm kiếm siêu tốc khi bấm link
    token = models.CharField(
        max_length=255, unique=True, db_index=True
    )  # Mã chuỗi token an toàn
    is_used = models.BooleanField(default=False)  # Cờ chặn dùng lại link cũ
    expires_at = models.DateTimeField()  # Thời gian hết hạn
    created_at = models.DateTimeField(auto_now_add=True)


# BẢNG 6: departments (Danh mục Phòng ban / Đội nhóm) [cite: 498]
class Department(models.Model):
    manager = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="managed_departments",
    )  # Nếu tài khoản Manager bị xóa, phòng ban vẫn tồn tại
    name = models.CharField(max_length=100, unique=True)  # Chặn trùng lặp tên phòng ban
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# BẢNG 7: employee_profiles (Hồ sơ Nhân viên - Áp dụng giải pháp bóc tách hồ sơ)
class EmployeeProfile(models.Model):
    # Trường user_id đóng vai trò vừa là Khóa chính, vừa là Khóa ngoại liên kết 1-1 tới bảng users
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, primary_key=True, related_name="profile"
    )
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    department = models.ForeignKey(
        Department, on_delete=models.RESTRICT, null=True, related_name="employees"
    )  # Chặn xóa phòng ban nếu vẫn còn nhân viên bên trong
    avatar_url = models.CharField(
        max_length=500, blank=True, null=True
    )  # Đường dẫn ảnh đại diện
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name
