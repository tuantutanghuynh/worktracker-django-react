from django.contrib import admin
from .models import Client, Job


# Quản lý danh mục Khách hàng / Đối tác.
# is_active: cờ soft delete — False nghĩa là khách hàng đã bị vô hiệu hóa
# (không xóa vật lý để bảo toàn lịch sử các dự án đã liên kết).
# list_filter: lọc nhanh theo trạng thái hoạt động (active/inactive).
# search_fields: tìm theo tên khách hàng hoặc mã số thuế.
@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('id', 'client_name', 'tax_code', 'contact_person', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('client_name', 'tax_code')


# Quản lý danh mục Dự án / Gói công việc.
# client: khách hàng đặt dự án (FK đến bảng clients).
# manager: nhân viên phụ trách dự án — đây là field DUY NHẤT xác định
# phạm vi quyền truy cập của Manager trong toàn hệ thống.
# status: trạng thái dự án (PLANNING / ACTIVE / COMPLETED / ON_HOLD / CANCELLED).
# list_filter: lọc theo trạng thái và khách hàng.
@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('id', 'job_name', 'client', 'manager', 'status', 'deadline')
    list_filter = ('status', 'client')
    search_fields = ('job_name',)
