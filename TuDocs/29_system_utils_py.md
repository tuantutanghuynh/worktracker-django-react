# Executive Code Annotation: `backend/system/utils.py`

**Package / Module:** `backend.system.utils` · Audit Helper Functions

> **Cách đọc tài liệu me:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (trạm ghi sổ nhanh, trợ lý đóng dấu...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Luồng Xử Lý Nhanh (Simple Audit Log Shortcut Diagram)

```
 ┌───────────────────────────┐      ┌───────────────────────────┐
 │   View / Action Controller│      │      HTTP Request Object  │
 └─────────────┬─────────────┘      └─────────────┬─────────────┘
               │                                  │
               │ log_audit_event(actor, action,   │ request.META
               │   table_name, record_id, ...)    │ .get('REMOTE_ADDR')
               ▼                                  ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                    backend/system/utils.py                   │
 │                Hàm trợ lý ghi Audit Log trực tiếp             │
 └──────────────────────────────┬───────────────────────────────┘
                                │
                                │ AuditLog.objects.create(...)
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                 PostgreSQL Database (audit_logs)             │
 └──────────────────────────────────────────────────────────────┘
```

> **Vì sao ứng dụng lại có `utils.py` ghi log đơn giản bên cạnh `audit_manager_service.py`?**
> `utils.py` đóng vai trò là một "Hàm helper tiện ích rút gọn" (Convenience Wrapper / Backward Compatibility Helper). Đối với các thao tác đơn giản hoặc các module cũ chỉ cần ghi một sự kiện AuditLog nhanh gọn mà không cần Snapshot dữ liệu phức tạp, việc gọi `log_audit_event(...)` từ `utils.py` giúp code ngắn gọn, trực quan và dễ đọc.

> **Vì sao hàm chỉ lấy `request.META.get('REMOTE_ADDR')` thay vì xử lý proxy header phức tạp như `X-Forwarded-For`?**
> Đây là triển khai rút gọn cấp ứng dụng cơ bản. Đối với các yêu cầu trực tiếp từ máy khách trong môi trường dev hoặc nội bộ, `REMOTE_ADDR` trả về trực tiếp IP của kết nối socket TCP. Đối với môi trường Production có Reverse Proxy (Nginx), hệ thống sẽ ưu tiên dùng service chuẩn `audit_manager_service.py`.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

```python
from system.models import AuditLog
# "from system.models import AuditLog" = Nhập (import) model `AuditLog` từ app `system`.
# Giúp hàm bên dưới có thể tương tác trực tiếp với bảng dữ liệu `audit_logs`.


def log_audit_event(actor, action, table_name, record_id, old_values=None, new_values=None, request=None):
# "def log_audit_event(...):" = Định nghĩa hàm ghi nhận sự kiện kiểm toán với 7 tham số:
#   - `actor`: Tài khoản thực hiện hành động (đối tượng CustomUser hoặc None).
#   - `action`: Tên mã hành động (VD: 'CREATE_JOB', 'LOCK_TIMESHEET').
#   - `table_name`: Tên bảng vật lý bị tác động (VD: 'jobs', 'clients').
#   - `record_id`: ID của bản ghi bị tác động.
#   - `old_values`: Snapshot dữ liệu cũ (mặc định = None).
#   - `new_values`: Snapshot dữ liệu mới (mặc định = None).
#   - `request`: Đối tượng HttpRequest hiện tại để trích xuất IP (mặc định = None).

    ip_address = None
    # "ip_address = None" = Khởi tạo biến lưu địa chỉ IP với giá trị mặc định là `None`.

    if request is not None:
    # "if request is not None:" = Kiểm tra xem đối tượng `request` có được truyền vào hàm hay không.
    # Ngăn ngừa lỗi `AttributeError` nếu hàm được gọi từ tác vụ ngầm không có HTTP request.

        ip_address = request.META.get('REMOTE_ADDR')
        # "request.META" = Một từ điển (dictionary) chứa tất cả các header và thông tin môi trường HTTP request.
        # ".get('REMOTE_ADDR')" = Lấy địa chỉ IP kết nối của máy khách từ biến `REMOTE_ADDR`.
        
    AuditLog.objects.create(
    # "AuditLog.objects.create(...)" = Gọi ORM của Django để thực thi câu lệnh SQL `INSERT INTO audit_logs ...`.

        user=actor,
        # Gán tài khoản thực hiện vào trường `user`.

        action=action,
        # Gán tên mã hành động vào trường `action`.

        table_name=table_name,
        # Gán tên bảng bị ảnh hưởng vào trường `table_name`.

        record_id=record_id,
        # Gán ID bản ghi vào trường `record_id`.

        old_values=old_values,
        # Gán dữ liệu snapshot cũ vào trường `old_values`.

        new_values=new_values,
        # Gán dữ liệu snapshot mới vào trường `new_values`.

        ip_address=ip_address,
        # Gán địa chỉ IP đã trích xuất vào trường `ip_address`.
    )
    # Kết thúc câu lệnh tạo bản ghi AuditLog.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Tên Hàm / Thành Phần | Tham Số Nhận Vào | Giá Trị Trả Về | Ý Nghĩa Kỹ Thuật & Nghiệp Vụ |
|---|---|---|---|
| **`log_audit_event`** | `actor`, `action`, `table_name`, `record_id`, `old_values`, `new_values`, `request` | `None` (Tạo bản ghi DB) | Hàm tiện ích rút gọn giúp các View/Action nhanh chóng ghi nhận vết log kiểm toán vào PostgreSQL |
| **`request.META`** | `'REMOTE_ADDR'` | Chuỗi IP hoặc `None` | Trích xuất địa chỉ IP của người dùng gửi request HTTP nếu có |
