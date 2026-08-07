# Executive Code Annotation: `backend/accounts/models.py`

**Package / Module:** `backend.accounts.models` · User & Authentication Database Models

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm vị von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Thực Thể Quan Hệ (Entity-Relationship Diagram)

```
 ┌─────────────────┐       1:N       ┌────────────────────────┐       N:1       ┌───────────────────┐
 │      Role       │ ───────────────<│     RolePermission     │>─────────────── │    Permission     │
 │ (code, name...) │                 │(role_id, permission_id)│                 │ (code, name...)   │
 └────────┬────────┘                 └────────────────────────┘                 └───────────────────┘
          │ 1:N
          ▼
 ┌─────────────────┐       1:1       ┌────────────────────────┐       N:1       ┌───────────────────┐
 │   CustomUser    │ ─────────────── │    EmployeeProfile     │>─────────────── │    Department     │
 │(email, password,│                 │(full_name, phone,      │                 │(name, manager_id) │
 │ is_active...)   │                 │ department_id...)      │                 └─────────┬─────────┘
 └────────┬────────┘                 └────────────────────────┘                           │
          │                                                                               │ 1:N
          │ 1:N (PasswordReset tokens)                                                    │ (managed)
          ▼                                                                               ▼
 ┌─────────────────┐                                                            ┌───────────────────┐
 │  PasswordReset  │                                                            │ CustomUser (Mgr)  │
 │(token, email...)│                                                            └───────────────────┘
 └─────────────────┘
```

> **Vì sao tách `CustomUser` và `EmployeeProfile` làm 2 bảng riêng biệt theo quan hệ 1:1 (`OneToOneField`)?**
> Đây là nguyên lý tách biệt trách nhiệm (Separation of Concerns). `CustomUser` chỉ chịu trách nhiệm làm **"thẻ định danh đăng nhập"** (Auth & RBAC Core Data: email, password, role, is_active). `EmployeeProfile` là **"hồ sơ nhân sự"** (Profile Data: full_name, phone, department, avatar). Khi hệ thống thực hiện xác thực Token JWT trên mỗi API call, Django chỉ cần query nhẹ vào bảng `users` mà không bị kéo theo các dữ liệu nặng của hồ sơ nhân viên.

> **Vì sao `Department.manager` KHÔNG được dùng để tính phạm vi truy cập (Access Scope) của Manager?**
> Trong WorkTracker, `Department.manager_id` chỉ mang tính chất danh mục / danh bạ sơ đồ tổ chức (Directory / Organizational info). Phạm vi công việc và bảng chấm công mà một Manager được phép duyệt **phải dựa trên `jobs.manager_id`** (Dự án do Manager đó trực tiếp quản lý). Điều này đảm bảo tính linh hoạt khi một Manager quản lý dự án liên phòng ban.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Các Thư Viện Lõi của Django

```python
from django.contrib.auth.models import AbstractUser, BaseUserManager
# "AbstractUser": Lớp Model cơ sở có sẵn của Django cung cấp sẵn các field như date_joined, is_staff, is_superuser...
# "BaseUserManager": Lớp Manager cơ sở dùng để tùy biến logic khởi tạo User/Superuser (thay đổi cách hash password, validate input).

from django.db import models
# "models": Module chứa tất cả các kiểu trường dữ liệu (CharField, ForeignKey, BooleanField...) và ORM mapping của Django.
```

---

### 2. Bảng 1: `Role` (Danh Mục Vai Trò RBAC)

```python
# ============================================================
# BẢNG 1: role
# Danh mục vai trò: ADMIN, MANAGER, EMPLOYEE
# ============================================================
class Role(models.Model):
# "class Role(models.Model)" = Đào một bảng mới tên `roles` trong CSDL để lưu các vai trò trong công ty.

    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )
    # "code" = Mã định danh vai trò (VD: 'ADMIN', 'MANAGER', 'EMPLOYEE').
    # "unique=True" = Không được phép có 2 role trùng mã.
    # "db_index=True" = Đánh chỉ mục B-Tree trong DB giúp tìm kiếm role siêu nhanh.

    name = models.CharField(max_length=100)
    # "name" = Tên hiển thị đầy đủ của vai trò (VD: 'Quản trị hệ thống', 'Trưởng phòng / Manager', 'Nhân viên').

    description = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    # "description" = Mô tả chi tiết quyền hạn của vai trò. Có thể để trống (`blank=True, null=True`).

    is_active = models.BooleanField(default=True)
    # "is_active = True" = Cờ trạng thái cho biết Vai trò này có đang được áp dụng hay bị tạm khóa.

    class Meta:
        db_table = "roles"
        # "db_table = 'roles'" = Đặt tên bảng chính xác trong PostgreSQL là `roles` thay vì mặc định `accounts_role`.

    def __str__(self):
        return self.name
        # Định nghĩa chuỗi đại diện khi in đối tượng Role ra màn hình.
```

---

### 3. Bảng 2 & 3: `Permission` & `RolePermission` (Ma Trận Phân Quyền)

```python
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
    # "code" = Mã hành động cụ thể (VD: 'task:create', 'timesheet:approve', 'report:export').

    name = models.CharField(max_length=150)
    # "name" = Tên mô tả hành động (VD: 'Quyền tạo công việc', 'Quyền duyệt bảng chấm công').

    class Meta:
        db_table = "permissions"

    def __str__(self):
        return self.code


# ============================================================
# BẢNG 3: role_permissions
# Bảng trung gian giữa Role và Permission
# ============================================================
class RolePermission(models.Model):
# Bảng liên kết nhiều-nhiều (N:M) giữa Role và Permission.
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    # Khóa ngoại trỏ tới `Role`. Nếu Role bị xóa, các quyền gắn liền với Role đó tự động bị xóa theo (`CASCADE`).

    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    # Khóa ngoại trỏ tới `Permission`.

    class Meta:
        db_table = "role_permissions"
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                name="unique_role_permission",
            )
        ]
        # "UniqueConstraint" = Đảm bảo 1 Role không thể gán trùng 1 Permission nhiều lần.

    def __str__(self):
        return f"{self.role.code} - {self.permission.code}"
```

---

### 4. `CustomUserManager` (Bộ Quản Lý Tạo Tài Khoản)

```python
# ============================================================
# Custom User Manager
# Cần có vì hệ thống dùng email để đăng nhập thay vì username
# ============================================================
class CustomUserManager(BaseUserManager):
# Lớp tùy biến logic tạo user/superuser vì hệ thống dùng Email làm khóa đăng nhập chính thay cho Username.

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
            # Bắt buộc phải có Email, nếu không quăng lỗi ngay.

        email = self.normalize_email(email)
        # Chuẩn hóa email (chuyển chữ hoa thành chữ thường ở phần domain, VD: Tu@Gmail.Com -> Tu@gmail.com).

        user = self.model(email=email, **extra_fields)
        # Khởi tạo đối tượng User với email đã chuẩn hóa.

        if password:
            user.set_password(password)
            # Mã hóa mật khẩu bằng thuật toán PBKDF2 của Django trước khi lưu.
        else:
            user.set_unusable_password()
            # Nếu không truyền pass, đặt mật khẩu không thể đăng nhập (dành cho tài khoản tạo sẵn chờ kích hoạt).

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

        if extra_fields.get("role") is None and extra_fields.get("role_id") is None:
            raise ValueError(
                "Superuser must have a role. Create ADMIN role first and pass role or role_id."
            )
            # Kiểm tra an toàn: Superuser bắt buộc phải gắn với Role ADMIN.

        return self.create_user(email, password, **extra_fields)
```

---

### 5. Bảng 4: `CustomUser` (Tài Khoản Người Dùng Core)

```python
# ============================================================
# BẢNG 4: users
# Tài khoản người dùng — chỉ lưu thông tin authentication và authorization cốt lõi.
# ============================================================
class CustomUser(AbstractUser):
    username = None
    first_name = None
    last_name = None
    # Loại bỏ 3 field mặc định của Django để tránh thừa dữ liệu và nhầm lẫn.

    email = models.EmailField(
        max_length=155,
        unique=True,
        db_index=True,
    )
    # Email làm định danh chính (đã được đánh chỉ mục `db_index=True`).

    role = models.ForeignKey(
        Role,
        on_delete=models.RESTRICT,
        related_name="users",
        null=True,
    )
    # "on_delete=models.RESTRICT" = Chặn xóa Role nếu đang có User gắn với Role đó (chống xóa nhầm ADMIN/MANAGER).

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )
    # Đánh index cho `is_active` vì field này được middleware/JWT auth kiểm tra ở MỌI request API.

    must_change_password = models.BooleanField(
        default=True
    )
    # Cờ buộc nhân viên đổi mật khẩu ở lần đăng nhập đầu tiên hoặc sau khi Admin reset pass.

    objects = CustomUserManager()
    # Gắn CustomUserManager làm bộ xử lý truy vấn mặc định.

    USERNAME_FIELD = "email"
    # Báo cho Django dùng `email` làm ô đăng nhập chính.

    REQUIRED_FIELDS = ["role"]
    # Bắt buộc nhập Role khi tạo user từ lệnh terminal `createsuperuser`.

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.email
```

---

### 6. Bảng 5: `PasswordReset` (Mã Quên Mật Khẩu)

```python
# ============================================================
# BẢNG 5: password_resets
# Token quên mật khẩu
# ============================================================
class PasswordReset(models.Model):
    email = models.EmailField(max_length=155, db_index=True)
    token = models.CharField(max_length=255, unique=True, db_index=True)
    # Chuỗi token ngẫu nhiên mã hóa gửi qua email reset mật khẩu.

    is_used = models.BooleanField(default=False)
    # Đánh dấu token đã được sử dụng hay chưa (mỗi token chỉ xài đúng 1 lần).

    expires_at = models.DateTimeField()
    # Thời điểm token hết hạn (thường là 15-30 phút sau khi tạo).

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_resets"

    def __str__(self):
        return self.email
```

---

### 7. Bảng 6 & 7: `Department` & `EmployeeProfile` (Sơ Đồ Phòng Ban & Hồ Sơ Nhân Viên)

```python
# ============================================================
# BẢNG 6: departments
# Phòng ban / đội nhóm
# ============================================================
class Department(models.Model):
    manager = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_departments",
    )
    # Quản lý trưởng phòng ban. Nếu quản lý nghỉ việc (`SET_NULL`), phòng ban vẫn tồn tại.

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "departments"

    def __str__(self):
        return self.name


# ============================================================
# BẢNG 7: employee_profiles
# Hồ sơ cá nhân của user
# ============================================================
class EmployeeProfile(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="profile",
    )
    # "primary_key=True" = Dùng luôn user_id làm Khóa chính của EmployeeProfile, tiết kiệm bộ nhớ & tối ưu SQL join 1:1.

    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True, null=True)

    department = models.ForeignKey(
        Department,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="employees",
    )
    # Phòng ban làm việc hiện tại của nhân viên.

    avatar_url = models.CharField(max_length=500, blank=True, null=True)
    joined_date = models.DateField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_profiles"

    def __str__(self):
        return self.full_name
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Tên Bảng (Database Table) | Class Model | Khóa Chính / Đặc Điểm Kỹ Thuật | Ý Nghĩa Nghiệp Vụ WorkTracker |
|-------------------|----------------|--------------------------------|-----------------------------|
| `roles` | `Role` | `code` (Unique, Index) | Lưu danh mục 3 vai trò gốc: ADMIN, MANAGER, EMPLOYEE |
| `permissions` | `Permission` | `code` (Unique, Index) | Lưu danh mục quyền chi tiết (`task:create`, `timesheet:approve`...) |
| `role_permissions` | `RolePermission` | UniqueConstraint(`role`, `permission`) | Bảng ma trận gán danh sách quyền hành động cho từng vai trò |
| `users` | `CustomUser` | `email` làm USERNAME_FIELD | Thẻ định danh tài khoản, chứa mật khẩu mã hóa & vai trò RBAC |
| `password_resets` | `PasswordReset` | `token` (Unique, Index) | Quản lý token cấp lại mật khẩu kèm thời gian hết hạn (`expires_at`) |
| `departments` | `Department` | `name` (Unique) | Danh mục phòng ban công ty (Directory info) |
| `employee_profiles` | `EmployeeProfile` | `user_id` làm Primary Key (1:1) | Lưu thông tin cá nhân nhân viên (họ tên, số điện thoại, ngày vào làm, avatar) |
