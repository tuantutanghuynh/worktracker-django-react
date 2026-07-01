from django.contrib import admin
from .models import AuditLog


# Quản lý Nhật ký Kiểm toán Hệ thống — CHỈ XEM, không cho thêm/sửa/xóa.
# Mục đích: truy vết các hành động nhạy cảm (tạo job, xóa client, khóa timesheet...).
# readonly_fields: tự động lấy tên tất cả các trường từ model AuditLog, ngăn người dùng chỉnh sửa dữ liệu log trong trang chi tiết.
# has_add_permission: trả về False → ẩn nút "Add AuditLog" trên trang admin.
# has_change_permission: trả về False → không cho sửa bất kỳ bản ghi nào.
# has_delete_permission: trả về False → không cho xóa bản ghi log.

# Tham số 'obj=...' trong change/delete permission là giá trị mặc định của Python — nghĩa là hàm hoạt động cho cả trang danh sách lẫn trang chi tiết.

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'action', 'table_name', 'user', 'record_id', 'ip_address', 'created_at')
    list_filter = ('action', 'table_name')
    search_fields = ('table_name', 'ip_address')
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=...):
        return False

    def has_delete_permission(self, request, obj=...):
        return False
