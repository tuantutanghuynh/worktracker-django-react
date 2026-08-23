# ┌─────────────────────────────────────────────────────────────────────┐
# │  SHARED FILE — MinhAnh · LongNguyen · TuanTu-3 đều import          │
# │                                                                      │
# │  MERGE RISK:                                                         │
# │  log_audit_event() được gọi từ TẤT CẢ các nhánh. Nếu thay đổi     │
# │  signature (tên tham số, thêm tham số bắt buộc), các nhánh khác    │
# │  sẽ bị lỗi TypeError khi gọi hàm. Nếu cần thêm tham số, dùng       │
# │  keyword argument với giá trị mặc định (optional), không bắt buộc. │
# └─────────────────────────────────────────────────────────────────────┘
from system.models import AuditLog

# severity thêm dưới dạng keyword argument optional (mặc định None -> NORMAL)
# để không phá vỡ các nhánh khác đang gọi log_audit_event() theo signature cũ.
def log_audit_event(actor, action, table_name, record_id, old_values=None, new_values=None, request=None, severity=None):
    ip_address = None
    if request is not None:
        ip_address = request.META.get('REMOTE_ADDR')

    AuditLog.objects.create(
        user=actor,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        severity=severity or AuditLog.Severity.NORMAL,
    )