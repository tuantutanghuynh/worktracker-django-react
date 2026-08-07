# Executive Code Annotation: `backend/system/models.py`

**Package / Module:** `backend.system.models` · System Audit & Notification Domain Models

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (sổ cái kế toán, camera giám sát, hộp thư thông báo, tem niêm phong...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Thực Thể Hệ Thống (System Entity-Relationship & Flow Diagram)

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           CustomUser (User)                            │
  └───────────────┬────────────────────────────────────────┬───────────────┘
                  │ 1                                      │ 1
                  │                                        │
                  │ (1:N, SET_NULL)                        │ (1:N, CASCADE)
                  ▼                                        ▼
  ┌────────────────────────────────┐      ┌────────────────────────────────┐
  │            AuditLog            │      │          Notification          │
  ├────────────────────────────────┤      ├────────────────────────────────┤
  │ - id: BigAutoField (PK)        │      │ - id: BigAutoField (PK)        │
  │ - user_id: FK (Nullable)       │      │ - user_id: FK (CustomUser)     │
  │ - action: CharField(50)        │      │ - type: ChannelType            │
  │ - severity: TextChoices        │      │   (SYSTEM_ONLY/EMAIL_ONLY/ALL) │
  │ - summary: TextField           │      │ - event_type: EventType (14)   │
  │ - table_name: CharField(50)    │      │ - title: CharField(255)        │
  │ - record_id: IntegerField      │      │ - content: TextField           │
  │ - old_values: JSONField        │      │ - related_url: CharField(255)  │
  │ - new_values: JSONField        │      │ - is_read: BooleanField        │
  │ - ip_address: IPAddressField   │      │ - is_sent_email: BooleanField  │
  │ - created_at: DateTimeField    │      │ - sent_at: DateTimeField       │
  └────────────────────────────────┘      │ - created_at: DateTimeField    │
                                          └────────────────────────────────┘
```

> **Vì sao `user` trong `AuditLog` lại dùng `on_delete=models.SET_NULL` thay vì `CASCADE`?**
> Bảng `AuditLog` đóng vai trò là "Sổ cái kế toán / Vết camera an ninh". Khi một tài khoản nhân viên hoặc quản lý bị xóa khỏi hệ thống (`CustomUser` bị xóa), các hành động nhạy cảm họ từng làm trong quá khứ (như xóa khách hàng, sửa giờ làm, khóa kỳ chấm công) vẫn PHẢI được lưu trữ để phục vụ kiểm toán độc lập. Nếu dùng `CASCADE`, việc xóa user sẽ kéo theo xóa sạch vết log — gây mất dấu vết nghiêm trọng (Violation of Auditability).

> **Vì sao `table_name` và `record_id` trong `AuditLog` lại lưu chuỗi tên bảng vật lý (`'jobs'`, `'tasks'`) mà không dùng Django `GenericForeignKey`?**
> Django `GenericForeignKey` đòi hỏi phải JOIN với bảng `django_content_type`, làm tăng chi phí truy vấn và phức tạp hóa việc ghi log. Trong khi đó, việc lưu trực tiếp `table_name` ('jobs', 'clients', 'tasks') và `record_id` giúp việc tạo chỉ mục (Index) kép `(table_name, record_id)` diễn ra cực nhanh, cho phép truy vết lịch sử thay đổi của 1 đối tượng cụ thể với tốc độ tính bằng miligiây mà không phụ thuộc vào ORM của Django.

> **Vì sao `ip_address` trong `AuditLog` lại cho phép `null=True` và `blank=True`?**
> Không phải hành động nào trong hệ thống cũng đến từ một HTTP Request trực tiếp của người dùng qua trình duyệt. Các hành động chạy ngầm theo định kỳ (Celery periodic tasks, tự động khóa kỳ chấm công cuối tháng, tự động quét công việc quá hạn) là do hệ thống tự kích hoạt (system-triggered), hoàn toàn không có địa chỉ IP của client.

> **Vì sao `Notification` lại tách riêng 2 trường `type` (ChannelType) và `event_type` (EventType)?**
> Đây là thiết kế tách biệt giữa **BẢN CHẤT SỰ KIỆN** (`event_type` - WHAT happened: phân công công việc, từ chối chấm công...) và **KÊNH PHÂN PHỐI** (`type` - HOW delivered: chỉ hiện trên app, gửi email, hoặc cả hai). Một sự kiện nghiệp vụ như `TASK_ASSIGNED` có thể được cấu hình gửi qua web, qua email hoặc cả hai tùy theo cài đặt của người dùng, tránh việc nhầm lẫn giữa nội dung thông báo và phương thức truyền tải.

> **Vì sao `event_type` trong `Notification` KHÔNG ĐƯỢC đặt giá trị mặc định (`default`)?**
> Việc không đặt `default` buộc lập trình viên khi khởi tạo `Notification` phải truyền chính xác và tường minh mã sự kiện. Điều này ngăn ngừa triệt để lỗi lập trình silent bug khi tạo thông báo mà quên khai báo event_type, khiến thông báo bị gán sai danh mục mặc định.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Khai Báo Thư Viện Lõi & Model `AuditLog`

```python
from django.conf import settings
# "from django.conf import settings" = Nạp đối tượng chứa toàn bộ cấu hình settings của ứng dụng Django.
# Dùng để truy cập `settings.AUTH_USER_MODEL` nhằm liên kết FK tới model CustomUser một cách động.

from django.db import models
# "from django.db import models" = Nạp module quản lý Cơ sở dữ liệu và các trường (fields) của Django ORM.


# ============================================================
# BẢNG 11: audit_logs
# Nhật ký kiểm toán hệ thống.
# Ghi nhận các hành động nhạy cảm (CREATE_JOB, LOCK_TIMESHEET,
# SOFT_DELETE_CLIENT, ...) phục vụ truy vết và đối soát.
#
# Lưu ý:
# - Dùng BIGINT vì volume log có thể lớn theo thời gian.
# - user_id dùng SET NULL để giữ vết log ngay cả khi user bị xóa.
# - ip_address nullable theo §6.3.11: các action chạy ngầm
#   (Celery, system-triggered) có thể không có request IP.
# ============================================================
class AuditLog(models.Model):
# "class AuditLog(models.Model):" = Khai báo lớp AuditLog kế thừa từ `models.Model`.
# Đại diện cho bảng `audit_logs` trong CSDL — nơi lưu trữ nhật ký mọi thao tác biến động dữ liệu nhạy cảm.

    class Severity(models.TextChoices):
    # "class Severity(models.TextChoices):" = Tạo một Enum lựa chọn mức độ nghiêm trọng của hành động.
    # Kế thừa từ `models.TextChoices` giúp Django tạo danh sách giá trị cố định kèm nhãn hiển thị readable.

        CRITICAL = 'CRITICAL', 'Critical'
        # Mức độ nghiêm trọng cao nhất (VD: Khóa kỳ chấm công, xóa dữ liệu khách hàng, thay đổi phân quyền Admin).

        WARNING  = 'WARNING',  'Warning'
        # Mức độ cảnh báo (VD: Sửa đổi thông tin giờ làm đã nộp, thay đổi trạng thái công việc trọng yếu).

        NORMAL   = 'NORMAL',   'Normal'
        # Mức độ bình thường (VD: Tạo mới công việc, cập nhật mô tả task, tải file đính kèm).

    id = models.BigAutoField(primary_key=True)
    # "id = models.BigAutoField(primary_key=True)" = Khóa chính 64-bit tự động tăng.
    # Ví von: Số thứ tự ghi trong sổ nhật ký. Dùng `BigAutoField` (BIGINT) để đảm bảo không bị đụng trần lưu trữ
    # ngay cả khi hệ thống ghi hàng trăm triệu dòng log qua nhiều năm.

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    # "user = models.ForeignKey(...)" = Khóa ngoại liên kết tới tài khoản thực hiện hành động (`CustomUser`).
    # "settings.AUTH_USER_MODEL" = Tham chiếu động tới 'accounts.CustomUser'.
    # "on_delete=models.SET_NULL" = Nếu người dùng này bị xóa khỏi DB, giá trị `user_id` trong nhật ký sẽ đổi thành NULL
    # chứ KHÔNG XÓA dòng nhật ký này. Giữ nguyên vết lịch sử phục vụ kiểm toán độc lập.
    # "null=True, blank=True" = Cho phép không có người thực hiện (dành cho các tác vụ hệ thống tự động chạy).
    # "related_name='audit_logs'" = Cho phép truy vấn ngược từ user lấy danh sách log: `user.audit_logs.all()`.

    # Tên hành động: 'CREATE_JOB', 'SOFT_DELETE_CLIENT', 'LOCK_TIMESHEET', ...
    action = models.CharField(max_length=50)
    # "action = models.CharField(max_length=50)" = Chuỗi văn bản tối đa 50 ký tự lưu mã hành động.
    # Ví von: "Tên nhãn đóng dấu" trên hồ sơ (VD: 'CREATE_JOB', 'LOCK_TIMESHEET', 'APPROVE_LOG_WORK').

    severity = models.CharField(
        max_length=10,
        choices=Severity.choices,
        default=Severity.NORMAL,
        db_index=True,
    )
    # "severity = models.CharField(...)" = Mức độ nghiêm trọng của log ('CRITICAL', 'WARNING', 'NORMAL').
    # "choices=Severity.choices" = Giới hạn giá trị nằm trong enum `Severity`.
    # "default=Severity.NORMAL" = Giá trị mặc định là 'NORMAL'.
    # "db_index=True" = Đánh chỉ mục CSDL để hỗ trợ lọc nhanh các log nguy hiểm (`CRITICAL`) trên giao diện Admin.

    summary = models.TextField(blank=True, null=True)
    # "summary = models.TextField(blank=True, null=True)" = Văn bản diễn giải tóm tắt hành động bằng ngôn ngữ tự nhiên.
    # VD: "Nguyễn Văn A đã khóa kỳ chấm công tháng 07/2026 của Phòng Kỹ thuật".

    # Tên bảng bị tác động. Phải khớp tên bảng vật lý trong DB
    # (vd: 'jobs', 'clients', 'tasks'), KHÔNG phải tên Django model.
    table_name = models.CharField(max_length=50)
    # "table_name = models.CharField(max_length=50)" = Tên bảng vật lý trong PostgreSQL chịu sự biến động dữ liệu.
    # VD: 'jobs', 'clients', 'tasks', 'timesheets' (lưu ý: là tên bảng DB vật lý, không phải tên class Model Python).

    # ID của bản ghi bị tác động trong bảng table_name.
    record_id = models.IntegerField()
    # "record_id = models.IntegerField()" = Số ID định danh của bản ghi bị thay đổi trong bảng `table_name`.
    # Kết hợp `(table_name, record_id)` tạo thành cặp định danh duy nhất cho bất kỳ đối tượng nào trong hệ thống.

    # Snapshot dữ liệu trước/sau khi thay đổi.
    old_values = models.JSONField(blank=True, null=True)
    # "old_values = models.JSONField(blank=True, null=True)" = Ảnh chụp (Snapshot) dữ liệu CŨ dưới dạng JSON trước khi sửa/xóa.
    # Ví von: Bức ảnh chụp hiện trạng căn phòng trước khi cải tạo. Trả về `None` nếu là hành động tạo mới (CREATE).

    new_values = models.JSONField(blank=True, null=True)
    # "new_values = models.JSONField(blank=True, null=True)" = Ảnh chụp (Snapshot) dữ liệu MỚI dưới dạng JSON sau khi tạo/sửa.
    # Ví von: Bức ảnh chụp căn phòng sau khi đã hoàn thiện. Trả về `None` nếu là hành động xóa (DELETE).

    # Cho phép NULL khi action được trigger bởi background process (Celery)
    # hoặc system-triggered action không có request context.
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    # "ip_address = models.GenericIPAddressField(blank=True, null=True)" = Địa chỉ IP của máy khách gửi yêu cầu (IPv4 hoặc IPv6).
    # Để `null=True` vì các tiến trình chạy ngầm qua Celery/Cronjob không có IP người dùng.

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # "created_at = models.DateTimeField(auto_now_add=True, db_index=True)" = Dấu mốc thời gian ghi log.
    # "auto_now_add=True" = Tự động lấy thời điểm hiện tại khi tạo bản ghi.
    # "db_index=True" = Đánh chỉ mục để truy vấn lọc nhật ký theo khoảng thời gian nhanh chóng.

    class Meta:
        db_table = "audit_logs"
        # "db_table = 'audit_logs'" = Định danh chính xác tên bảng vật lý trong Cơ sở dữ liệu PostgreSQL.

        indexes = [
            # Truy vấn lịch sử của một record cụ thể (vd: mọi thay đổi của job ID 42)
            models.Index(fields=["table_name", "record_id"]),
            # Đánh chỉ mục phức hợp (Composite Index) trên 2 cột `table_name` và `record_id`.
            # Giúp câu lệnh SQL: `SELECT * FROM audit_logs WHERE table_name='jobs' AND record_id=42` chạy trong O(log N).

            # Truy vết theo user theo thứ tự thời gian
            models.Index(fields=["user", "created_at"]),
            # Đánh chỉ mục phức hợp trên `user` và `created_at`.
            # Phục vụ tính năng: "Xem toàn bộ lịch sử thao tác của nhân viên X theo dòng thời gian".
        ]

    def __str__(self):
        return f"{self.action} on {self.table_name} (ID: {self.record_id})"
        # "def __str__(self):" = Chuỗi đại diện khi in đối tượng `AuditLog`.
        # VD: "CREATE_JOB on jobs (ID: 42)".
```

---

### 2. Model `Notification` — Trung Tâm Thông Báo

```python
# ============================================================
# BẢNG 16: notifications
# Trung tâm thông báo và hàng đợi email.
# Persist cả khi realtime delivery thất bại (FR-69, FR-119).
#
# Lưu ý quan trọng theo §6.3.17:
# - event_type (what happened) và type (how delivered) là 2 field
#   ĐỘC LẬP. Không được conflate. Vd: TASK_ASSIGNED có thể được
#   gửi qua SYSTEM_ONLY hoặc EMAIL_ONLY hoặc ALL.
# - Dùng BIGINT vì volume notification có thể lớn.
# ============================================================
class Notification(models.Model):
# "class Notification(models.Model):" = Khai báo model Notification đại diện cho bảng `notifications`.
# Lưu trữ toàn bộ thông báo gửi tới người dùng trong ứng dụng.

    # Kênh phân phối: notification được gửi qua đâu.
    class ChannelType(models.TextChoices):
    # Enum định nghĩa Kênh truyền tải thông báo (HOW delivered):

        SYSTEM_ONLY = "SYSTEM_ONLY", "System Only"
        # Chỉ hiển thị trên chuông thông báo (In-app Notification) của ứng dụng web.

        EMAIL_ONLY = "EMAIL_ONLY", "Email Only"
        # Chỉ gửi email đến hòm thư người dùng, không lưu hiển thị chuông ứng dụng.

        ALL = "ALL", "All Channels"
        # Phân phối trên tất cả các kênh (vừa hiển thị chuông in-app vừa gửi email).

    # Loại sự kiện nghiệp vụ. Dùng cho filter, routing, UI icon/text.
    # Theo FR-69, FR-119 và §6.4.17.
    class EventType(models.TextChoices):
    # Enum định nghĩa Bản chất sự kiện nghiệp vụ (WHAT happened):

        TASK_ASSIGNED = "TASK_ASSIGNED", "Task Assigned"
        # Được giao một công việc mới.

        TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED", "Task Status Changed"
        # Trạng thái công việc bị thay đổi (VD: In Progress -> Done).

        TASK_COMMENT = "TASK_COMMENT", "Task Comment"
        # Có bình luận mới trong công việc đang theo dõi.

        TASK_SUBMITTED = "TASK_SUBMITTED", "Task Submitted"
        # Nhân viên nộp báo cáo hoàn thành công việc chờ duyệt.

        TASK_APPROVED = "TASK_APPROVED", "Task Approved"
        # Quản lý phê duyệt báo cáo công việc.

        TASK_REJECTED = "TASK_REJECTED", "Task Rejected"
        # Quản lý từ chối báo cáo công việc và yêu cầu làm lại.

        TASK_ATTACHMENT = "TASK_ATTACHMENT", "Task Attachment"
        # File đính kèm mới được tải lên công việc.

        TIMESHEET_LOCK = "TIMESHEET_LOCK", "Timesheet Lock"
        # Kỳ chấm công đã bị khóa.

        TIMESHEET_UNLOCK = "TIMESHEET_UNLOCK", "Timesheet Unlock"
        # Kỳ chấm công được mở khóa lại.

        REPORT_EXPORTED = "REPORT_EXPORTED", "Report Exported"
        # Báo cáo tổng hợp đã được xuất file thành công.

        ACCOUNT_OR_PERMISSION_CHANGED = (
            "ACCOUNT_OR_PERMISSION_CHANGED",
            "Account or Permission Changed",
        )
        # Quyền hạn hoặc thông tin tài khoản bị thay đổi bởi Quản trị viên.

        LOG_WORK_APPROVED = "LOG_WORK_APPROVED", "Log Work Approved"
        # Giờ làm việc (Log Work) được phê duyệt.

        LOG_WORK_REJECTED = "LOG_WORK_REJECTED", "Log Work Rejected"
        # Giờ làm việc bị từ chối.

        LOG_WORK_VOIDED = "LOG_WORK_VOIDED", "Log Work Voided"
        # Giờ làm việc bị hủy bỏ/vô hiệu hóa.

    id = models.BigAutoField(primary_key=True)
    # "id = models.BigAutoField(primary_key=True)" = Khóa chính ID tự tăng 64-bit cho bảng thông báo.

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    # "user = models.ForeignKey(...)" = Người nhận thông báo này (`CustomUser`).
    # "on_delete=models.CASCADE" = Khi tài khoản người dùng bị xóa hoàn toàn khỏi DB, các thông báo dành cho họ sẽ bị xóa theo.
    # "db_index=True" = Tối ưu truy vấn danh sách thông báo của 1 user.

    # Kênh phân phối (HOW it was delivered).
    type = models.CharField(
        max_length=50,
        choices=ChannelType.choices,
        default=ChannelType.SYSTEM_ONLY,
    )
    # "type = models.CharField(...)" = Kênh phát thông báo, mặc định là `SYSTEM_ONLY`.

    # Loại sự kiện (WHAT happened).
    # KHÔNG đặt default để buộc code gọi tường minh, tránh tạo
    # notification mặc định sai event_type.
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        db_index=True,
    )
    # "event_type = models.CharField(...)" = Mã loại sự kiện nghiệp vụ. Đánh chỉ mục `db_index=True` để lọc theo loại thông báo.

    title = models.CharField(max_length=255)
    # "title = models.CharField(max_length=255)" = Tiêu đề ngắn gọn của thông báo (VD: "Bạn được giao công việc mới").

    content = models.TextField(blank=True, null=True)
    # "content = models.TextField(blank=True, null=True)" = Nội dung chi tiết của thông báo.

    # URL điều hướng khi user click vào notification.
    related_url = models.CharField(max_length=255, blank=True, null=True)
    # "related_url = models.CharField(...)" = Đường dẫn Frontend để người dùng bấm vào chuyển hướng thẳng tới màn hình liên quan.
    # VD: `/tasks/102` hoặc `/timesheets/2026-07`.

    is_read = models.BooleanField(default=False)
    # "is_read = models.BooleanField(default=False)" = Đánh dấu thông báo đã được xem chưa. Mặc định là `False` (Chưa đọc).

    is_sent_email = models.BooleanField(default=False)
    # "is_sent_email = models.BooleanField(default=False)" = Đánh dấu email đã được gửi thành công đi chưa.

    sent_at = models.DateTimeField(blank=True, null=True)
    # "sent_at = models.DateTimeField(...)" = Thời điểm email được gửi đi thành công.

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # "created_at = models.DateTimeField(...)" = Thời điểm tạo thông báo. Đánh chỉ mục để sắp xếp thông báo mới nhất lên đầu.

    class Meta:
        db_table = "notifications"
        # Khai báo tên bảng vật lý `notifications`.

    def __str__(self):
        return f"[{self.event_type}] {self.title} → {self.user_id}"
        # ĐỊnh dạng hiển thị ngắn gọn dạng: "[TASK_ASSIGNED] Bạn được giao task X → User #12".
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Model Class | Trường Dữ Liệu | Kiểu Dữ Liệu / Constraint | Ý Nghĩa Kỹ Thuật & Nghiệp Vụ |
|---|---|---|---|
| **`AuditLog`** | `id` | `BigAutoField(primary_key=True)` | Khóa chính 64-bit đảm bảo không cạn dung lượng số khi ghi hàng triệu log |
| | `user` | `ForeignKey(CustomUser, SET_NULL, null=True)` | Giữ nguyên lịch sử kiểm toán ngay cả khi nhân viên/quản lý bị xóa tài khoản |
| | `action` | `CharField(max_length=50)` | Mã hành động nhạy cảm (VD: `CREATE_JOB`, `LOCK_TIMESHEET`) |
| | `severity` | `CharField(choices=Severity)` | Mức độ nghiêm trọng (`CRITICAL`, `WARNING`, `NORMAL`) |
| | `table_name` & `record_id` | `CharField(50)` & `IntegerField` | Định danh chính xác đối tượng bị tác động kèm chỉ mục phức hợp `(table_name, record_id)` |
| | `old_values` & `new_values` | `JSONField(null=True)` | Snapshot cấu trúc dữ liệu JSON trước và sau biến động để đối soát sai lệch |
| | `ip_address` | `GenericIPAddressField(null=True)` | Địa chỉ IP gửi request, cho phép NULL đối với tiến trình Celery/Hệ thống tự động |
| **`Notification`** | `user` | `ForeignKey(CustomUser, CASCADE)` | Người nhận thông báo. Tự động xóa sạch thông báo nếu user bị xóa |
| | `type` | `CharField(choices=ChannelType)` | Kênh phân phối thông báo (`SYSTEM_ONLY`, `EMAIL_ONLY`, `ALL`) |
| | `event_type` | `CharField(choices=EventType)` | 14 loại sự kiện nghiệp vụ (`TASK_ASSIGNED`, `TIMESHEET_LOCK`, `LOG_WORK_APPROVED`...) |
| | `related_url` | `CharField(max_length=255)` | Đường dẫn trang Frontend giúp người dùng bấm chuông nhảy ngay tới màn hình xử lý |
| | `is_read` & `is_sent_email` | `BooleanField(default=False)` | Trạng thái đọc thông báo trên Web và trạng thái đã đẩy email qua Celery |
