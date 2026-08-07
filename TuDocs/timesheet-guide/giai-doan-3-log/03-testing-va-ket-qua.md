# 03 — Testing & Kết quả thực tế

## Phần 1 — Test `ManagerTimeLockView` (Giai đoạn 3)

Login bằng `manager@worktracker.com` (đã đặt password `Test1234!` từ
Giai đoạn 1).

### Test 1 — Khóa kỳ 8/2026 (kỳ vọng 201)

```bash
curl -s http://127.0.0.1:8000/api/timesheets/time-locks/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"lock_month": 8, "lock_year": 2026}'
```
```text
{"id":1,"lock_month":8,"lock_year":2026,"is_locked":true,"locked_by":2,"locked_at":"2026-07-18T14:44:01.238971Z"}
```
✅ Đúng kỳ vọng.

### Test 2 — Khóa lại đúng kỳ đã khóa (kỳ vọng 400)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/time-locks/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"lock_month": 8, "lock_year": 2026}'
```

**Lần chạy đầu** (trước khi sửa bug `UniqueTogetherValidator`, xem file 01):
```text
{"non_field_errors":["The fields lock_month, lock_year must make a unique set."]}
HTTP_STATUS:400
```
Status đúng, message sai (không phải message tự viết).

**Lần chạy sau khi sửa**:
```text
{"non_field_errors":["This period is already locked."]}
HTTP_STATUS:400
```
✅ Đúng kỳ vọng — status và message đều đúng thiết kế.

### Test 3 — `lock_month` không hợp lệ (kỳ vọng 400)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/time-locks/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"lock_month": 13, "lock_year": 2026}'
```
```text
{"lock_month":["lock_month must be between 1 and 12."]}
HTTP_STATUS:400
```
✅ Đúng kỳ vọng.

### Test 4 — RBAC: Employee gọi API (không có quyền `timesheet:lock`, kỳ vọng 403)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/time-locks/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"lock_month": 9, "lock_year": 2026}'
```
```text
{"detail":"You do not have permission to perform this action."}
HTTP_STATUS:403
```
✅ Đúng kỳ vọng.

## Phần 2 — Test Time Lock check trong Log Work (Giai đoạn 4)

Kỳ 8/2026 đã bị khóa từ Test 1 ở trên — dùng luôn để test.

### Test 5 — Log work vào kỳ ĐÃ khóa, `work_date=2026-08-05` (kỳ vọng 403)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-08-05", "hours_spent": "3", "description": "locked period"}'
```
```text
{"detail":"Period 8/2026 is locked. Contact your manager to unlock it."}
HTTP_STATUS:403
```
✅ Đúng kỳ vọng.

### Test 6 — Log work vào kỳ CHƯA khóa, `work_date=2026-07-21` (kỳ vọng 201)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-21", "hours_spent": "3", "description": "unlocked period"}'
```
```text
{"id":5,"task":1,"work_date":"2026-07-21","hours_spent":"3.00","description":"unlocked period"}
HTTP_STATUS:201
```
✅ Đúng kỳ vọng — xác nhận Giai đoạn 2 (24h-cap) vẫn hoạt động bình thường
song song với Time Lock check mới thêm.

### Test 7 — Xác nhận dừng sớm: KHÔNG tạo dòng `daily_user_timesheets` rác khi bị Time Lock chặn

```bash
python manage.py shell -c "
from timesheets.models import DailyUserTimesheet
print(DailyUserTimesheet.objects.filter(work_date='2026-08-05').count())
"
```
```text
0
```
✅ Đúng kỳ vọng — Time Lock check raise `PermissionDenied` trước khi code
chạm tới `get_or_create()`, nên không có tác dụng phụ nào để lại trong DB.

## Bảng tổng hợp kết quả

| # | Trường hợp | Status mong đợi | Status thực tế | Kết quả |
|---|---|---|---|---|
| 1 | Khóa kỳ mới | 201 | 201 | ✅ |
| 2 | Khóa lại kỳ đã khóa | 400, message rõ ràng | 400, đúng message sau khi sửa | ✅ |
| 3 | `lock_month` không hợp lệ | 400 | 400 | ✅ |
| 4 | RBAC: Employee không có quyền `timesheet:lock` | 403 | 403 | ✅ |
| 5 | Log work vào kỳ đã khóa | 403 | 403 | ✅ |
| 6 | Log work vào kỳ chưa khóa (Giai đoạn 2 vẫn chạy đúng) | 201 | 201 | ✅ |
| 7 | Không có dòng rác khi bị Time Lock chặn | 0 dòng | 0 dòng | ✅ |

**Giai đoạn 3-4 (Time Lock API + Lớp phòng thủ 1) hoàn tất** — 7/7 test
case đúng kỳ vọng.

## Việc KHÔNG làm trong Giai đoạn 3-4 này (để khỏi lan phạm vi)

- API Unlock (mở khóa lại kỳ báo cáo) — chưa chốt với team.
- Admin override Time Lock — chưa chốt với team.
- Timesheet Review filter phía Manager (Giai đoạn 5 gốc) — khả năng đã
  chuyển sang phạm vi Đức Long theo v2 (FR-124), cần xác nhận lại trước khi
  ai đó code trùng.
- Sửa/xóa (void) `log_work` — Giai đoạn 6, theo FR-58 (void thay vì delete).
