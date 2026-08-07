# 04 — FR-72: Thêm EventType cho notification log work review

## Vì sao làm trước tiên trong ngày — đang chặn Đức Long

`Notification.EventType` (`system/models.py`) là danh sách đóng — mọi lời
gọi `notify(event_type=...)` (hàm dùng chung, `system/services/
notification_manager_service.py`) đều bị `validate_event_type()` chặn nếu
giá trị không nằm trong danh sách này (`raise ValueError`).

Đức Long đã viết xong 4 hàm approve/reject/correct/void trong
`logwork_review_manager_service.py`, đã gọi `log_action()`, nhưng **chưa
gọi `notify()`** — kiểm tra thấy đúng là do 3 giá trị `LOG_WORK_APPROVED`/
`REJECTED`/`VOIDED` chưa tồn tại, gọi vào sẽ crash ngay. Roadmap của Tuấn
Tú ghi rõ: *"đảm bảo 3 type trên được hỗ trợ trước khi Đức Long tích hợp"*
— nên làm việc này trước, càng sớm càng đỡ chặn người khác.

## Code — `backend/system/models.py`, trong `class EventType`

```python
LOG_WORK_APPROVED = "LOG_WORK_APPROVED", "Log Work Approved"
LOG_WORK_REJECTED = "LOG_WORK_REJECTED", "Log Work Rejected"
LOG_WORK_VOIDED = "LOG_WORK_VOIDED", "Log Work Voided"
```

## Hiểu sai ban đầu (của Claude, không phải người học) — bài học về migration

Lúc đầu khẳng định "không cần migration" vì `Notification.event_type`
không có `CheckConstraint` ở DB (khác `LogWork.review_status`, có
constraint riêng). **Sai một nửa**: chạy thử mới phát hiện
`makemigrations --check --dry-run` vẫn đòi tạo migration
(`AlterField event_type on notification`).

Verify bằng `manage.py sqlmigrate system 0005`:

```sql
BEGIN;
-- Alter field event_type on notification
-- (no-op)
COMMIT;
```

**Kết luận đúng**: `choices=` không tạo ràng buộc ở DB (cột Postgres vẫn
chỉ là `VARCHAR`, chấp nhận mọi chuỗi ≤ max_length) — nhưng Django vẫn ghi
lại thay đổi `choices` vào migration để đồng bộ "sổ sách" (migration
history phải khớp với `models.py`, nếu không lần `makemigrations --check`
sau sẽ luôn báo lệch dù không đổi gì thêm). `choices` vẫn có tác dụng thật
ở tầng ứng dụng: `full_clean()`, dropdown Django Admin, DRF tự sinh
`ChoiceField`.

**Có migration file ≠ có DDL thật** — 2 khái niệm khác nhau, phải tự kiểm
tra bằng `sqlmigrate` chứ không đoán từ tên loại field.

## Verify bằng test thật (không chỉ đọc code)

```python
from system.models import Notification
from system.services.notification_manager_service import validate_event_type

validate_event_type(Notification.EventType.LOG_WORK_APPROVED)  # không lỗi

try:
    validate_event_type('LOG_WORK_APPROVE')  # thiếu chữ D — cố tình gõ sai
except ValueError as e:
    print('Correctly raised ValueError:', e)
```

```text
validate_event_type passed for LOG_WORK_APPROVED
Correctly raised ValueError: Invalid notification event_type: LOG_WORK_APPROVE
```

✅ Đúng kỳ vọng cho cả 2 trường hợp — migration `0005` đã `migrate` thành
công (dù no-op).

## Việc còn nợ

Đức Long vẫn cần tự thêm lời gọi `notify()` vào 4 hàm review của anh ấy —
phần này không thuộc code của Tuấn Tú, chỉ cần báo cho anh ấy biết 3
`EventType` đã sẵn sàng dùng.
