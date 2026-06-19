from django.contrib import admin

# Register your models here.
from .models import CustomUser, Department, EmployeeProfile, PasswordReset,Permission, Role, RolePermission

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'name')
    search_fields = ('code','name')

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('id','code','name')
    search_fields = ('code','name')

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('id','email','username')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email','username')

@admin.register(PasswordReset)
class PasswordResetAdmin(admin.ModelAdmin):
    list_display = ('id','email','is_used', 'expires_at', 'created_at')
    search_fields = ('email',)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id','name','manager')
    search_fields = ('name',)

@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ('user','full_name','phone_number','department')
    search_fields = ('full_name','phone_number')

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('id','role','permission')
    list_filter = ('role',)