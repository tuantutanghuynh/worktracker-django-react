"""
Module: accounts.models
Description: Defines core data models for IAM, RBAC, users, departments, and employee profiles.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Role(models.Model):
    """Represents a system role such as ADMIN, MANAGER, or EMPLOYEE."""

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
        """Returns the role display name."""
        return self.name


class Permission(models.Model):
    """Represents an actionable system permission code."""

    code = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
    )
    name = models.CharField(max_length=150)

    class Meta:
        db_table = "permissions"

    def __str__(self):
        """Returns the permission code."""
        return self.code


class RolePermission(models.Model):
    """Intermediary mapping table linking roles to their granted permissions."""

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
        """Returns a string representation of role-permission pair."""
        return f"{self.role.code} - {self.permission.code}"


class CustomUserManager(BaseUserManager):
    """Custom manager supporting email-based authentication instead of usernames."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and return a standard user with a normalized email address."""
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
        """Create and return a superuser with admin staff privileges and an assigned role."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # Require a valid role assignment when creating superuser
        if extra_fields.get("role") is None and extra_fields.get("role_id") is None:
            raise ValueError(
                "Superuser must have a role. Create ADMIN role first and pass role or role_id."
            )

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    """Custom user model using email as the unique identifier for authentication."""

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

    # Re-declare is_active to add database indexing
    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    # Flag forcing password reset upon first login or admin credential reset
    must_change_password = models.BooleanField(
        default=True
    )
    
    objects = CustomUserManager()

    USERNAME_FIELD = "email"

    # Require role input when provisioning superusers via management command
    REQUIRED_FIELDS = ["role"]

    class Meta:
        db_table = "users"

    def __str__(self):
        """Returns the user email."""
        return self.email


class PasswordReset(models.Model):
    """Stores one-time verification tokens for self-service password resets."""

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
        """Returns the reset token associated email."""
        return self.email


class Department(models.Model):
    """Represents an organizational department or team unit."""

    # Organizational directory manager reference (not used for job scope calculations)
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
        """Returns the department name."""
        return self.name


class EmployeeProfile(models.Model):
    """Stores extended personal and operational profile details for an account."""

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
    # Direct supervisory manager assignment (separated from administrative department)
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
        """Returns the full name of the employee."""
        return self.full_name
