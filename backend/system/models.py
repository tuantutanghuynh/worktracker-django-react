from django.db import models
from django.conf import settings


# Bảng 11: audit_logs (Nhật ký Kiểm toán Hệ thống)
class AuditLog(models.Model):
    # Dùng BIGINT đề phòng dung lượng phình to theo thời gian 
    id = models.BigAutoField(primary_key=True)

    # FK trỏ đến users. ON DELETE SET NULL để bảo toàn vết log khi xóa tài khoản 
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    action = models.CharField(
        max_length=50
    )  # 'CREATE_JOB', 'SOFT_DELETE_CLIENT', v.v. 
    table_name = models.CharField(max_length=50)  # Tên bảng bị tác động
    record_id = models.IntegerField()  # ID của dòng dữ liệu bị tác động

    # Sử dụng JSONField của PostgreSQL để lưu trữ dữ liệu dạng Object
    old_values = models.JSONField(blank=True, null=True)  
    new_values = models.JSONField(blank=True, null=True)  

    # <-- ĐÃ SỬA THEO FR-93 (DB IMPACT): Cho phép null khi tiến trình chạy ngầm qua Celery
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"{self.action} on {self.table_name} (ID: {self.record_id})"