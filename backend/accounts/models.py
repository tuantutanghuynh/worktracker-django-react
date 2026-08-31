from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


# ============================================================
# BẢNG 1: role
# Danh mục vai trò: ADMIN, MANAGER, EMPLOYEE
# ============================================================
class Role(models.Model):
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )
    name = models.CharField(max_length=100)
    description = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "roles"

    def __str__(self):
        return self.name


# ============================================================
# BẢNG 2: permissions
# Danh mục quyền hành động trong hệ thống
# ============================================================
class Permission(models.Model):
    code = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
    )
    name = models.CharField(max_length=150)

    class Meta:
        db_table = "permissions"

    def __str__(self):
        return self.code


# ============================================================
# BẢNG 3: role_permissions
# Bảng trung gian giữa Role và Permission
# ============================================================
class RolePermission(models.Model):
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )

    class Meta:
        db_table = "role_permissions"
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                name="unique_role_permission",
            )
        ]

    def __str__(self):
        return f"{self.role.code} - {self.permission.code}"


# ============================================================
# Custom User Manager
# Cần có vì hệ thống dùng email để đăng nhập thay vì username
# ============================================================
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # Theo tài liệu, user phải có role.
        # Nếu tạo superuser bằng lệnh createsuperuser, hệ thống sẽ hỏi role.
        # Nếu tạo bằng code mà không truyền role, báo lỗi rõ ràng.
        if extra_fields.get("role") is None and extra_fields.get("role_id") is None:
            raise ValueError(
                "Superuser must have a role. Create ADMIN role first and pass role or role_id."
            )

        return self.create_user(email, password, **extra_fields)


# ============================================================
# BẢNG 4: users
# Tài khoản người dùng
# Chỉ lưu thông tin authentication và authorization cốt lõi
# Profile cá nhân lưu ở employee_profiles
# ============================================================
class CustomUser(AbstractUser):
    username = None
    first_name = None
    last_name = None

    email = models.EmailField(
        max_length=155,
        unique=True,
        db_index=True,
    )
    role = models.ForeignKey(
        Role, on_delete=models.RESTRICT, related_name="users", null=True
    )

    # AbstractUser đã có is_active, nhưng khai báo lại để thêm db_index
    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    must_change_password = models.BooleanField(
        default=True
    )  # Cờ buộc đổi mật khẩu lần đầu đăng nhập hoặc sau khi reset
    
    objects = CustomUserManager()

    USERNAME_FIELD = "email"

    # Vì role là ForeignKey bắt buộc, createsuperuser sẽ yêu cầu nhập role id.
    REQUIRED_FIELDS = ["role"]

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.email


# ============================================================
# BẢNG 5: password_resets
# Token quên mật khẩu
# ============================================================
class PasswordReset(models.Model):
    email = models.EmailField(
        max_length=155,
        db_index=True,
    )
    token = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
    )
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_resets"

    def __str__(self):
        return self.email


# ============================================================
# BẢNG 6: departments
# Phòng ban / đội nhóm
#
# Lưu ý quan trọng:
# departments.manager_id chỉ là thông tin tổ chức / directory.
# Không dùng field này để tính Manager access scope.
# Manager scope phải dựa vào jobs.manager_id.
# ============================================================
class Department(models.Model):
    manager = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_departments",
    )
    name = models.CharField(
        max_length=100,
        unique=True,
    )
    description = models.TextField(
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "departments"

    def __str__(self):
        return self.name


# ============================================================
# BẢNG 7: employee_profiles
# Hồ sơ cá nhân của user
# Tách khỏi users để users chỉ giữ authentication data
# ============================================================
class EmployeeProfile(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="profile",
    )
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="employees",
    )
    # Tuyến báo cáo cố định: Employee này thuộc quyền Manager nào.
    #
    # Tách riêng khỏi `department` một cách có chủ đích. Department là đơn vị
    # HÀNH CHÍNH (chấm công, lương thưởng); manager là tuyến QUẢN LÝ công
    # việc. Gộp hai thứ vào một field thì mỗi lần đổi Manager cho một người
    # lại buộc phải chuyển phòng ban của họ, kéo theo sai lệch chấm công.
    #
    # SET_NULL chứ không RESTRICT: khoá tài khoản một Manager là việc bình
    # thường, không được để nó chặn đứng thao tác của Admin. Nhân viên rơi
    # về NULL sẽ hiện trong bộ lọc "Chưa gán" để Admin gán lại.
    manager = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_employees",
        limit_choices_to={"role__code": "MANAGER"},
    )
    avatar_url = models.CharField(
        max_length=500,
        blank=True,
        null=True,
    )
    joined_date = models.DateField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_profiles"

    def __str__(self):
        return self.full_name
