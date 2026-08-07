# 05 — Testing & Kết quả thực tế

## Chuẩn bị dữ liệu test

Bảng `tasks` và `projects` (Client/Job) ban đầu **rỗng** trong DB — app
`tasks` thuộc Đức Long chưa seed data. Vì `LogWork` bắt buộc phải trỏ tới 1
`Task` có thật (`on_delete=RESTRICT`), phải tự tạo tạm chuỗi dữ liệu qua
`manage.py shell` để test được luồng: `Client` → `Job` → `Task`.

```python
from django.utils import timezone
from accounts.models import CustomUser
from projects.models import Client, Job
from tasks.models import Task

manager = CustomUser.objects.get(email='manager@worktracker.com')
employee = CustomUser.objects.get(email='employee@worktracker.com')

client, _ = Client.objects.get_or_create(tax_code='TEST-0001', defaults={'client_name': 'Test Client'})
job, _ = Job.objects.get_or_create(
    job_name='Test Job',
    defaults={'client': client, 'manager': manager, 'start_date': timezone.now().date(), 'deadline': timezone.now().date()},
)
task, _ = Task.objects.get_or_create(
    title='Test Task for LogWork',
    defaults={'job': job, 'assignee': employee, 'creator': manager, 'deadline': timezone.now().date(), 'order_index': 'a1'},
)
```

Tạo thêm 1 `Task` thứ hai gán cho **1 employee khác** (`test@test.com`) để
test riêng case Data Isolation (Test 3 dưới đây).

> **Lưu ý**: `db.sqlite3` nằm trong `.gitignore` — dữ liệu test này chỉ tồn
> tại trên máy cá nhân, không lọt vào repo dùng chung. Vì cần password đã
> biết để login qua `curl`, đã `set_password('Test1234!')` cho 2 tài khoản
> dev có sẵn (`employee@worktracker.com`, `manager@worktracker.com`) —
> **nếu trước đó bạn tự đặt password khác cho 2 account này để test tay,
> giờ đã bị ghi đè**, cần nhớ dùng lại `Test1234!` hoặc tự đổi lại.

## Khởi động server và test bằng `curl`

```bash
python manage.py runserver 8000
```

### Test 1 — Tạo log work hợp lệ (kỳ vọng 201)

```bash
TOKEN=$(curl -s http://127.0.0.1:8000/api/auth/login/ -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@worktracker.com","password":"Test1234!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access'])")

curl -s http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-18", "hours_spent": "3.50", "description": "Test log work"}'
```

```text
{"id":1,"task":1,"work_date":"2026-07-18","hours_spent":"3.50","description":"Test log work"}
```

✅ Đúng kỳ vọng — 201, trả về đúng `id` thật do DB sinh.

### Test 2 — `hours_spent` không hợp lệ (kỳ vọng 400)

```bash
curl -s http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-18", "hours_spent": "0", "description": "Should fail"}'
```

```text
{"hours_spent":["hours_spent must be greater than 0."]}
```

✅ Đúng kỳ vọng — `validate_hours_spent` chặn đúng.

### Test 3 — Data Isolation: log work vào Task của người khác (kỳ vọng 400)

Task id=2 được gán cho `test@test.com`, không phải `employee@worktracker.com`
đang dùng token ở trên:

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 2, "work_date": "2026-07-18", "hours_spent": "2", "description": "Should be blocked"}'
```

```text
{"task":["You can only log work on tasks assigned to you."]}
HTTP_STATUS:400
```

✅ Đúng kỳ vọng — `validate_task` chặn đúng, không lộ dữ liệu Task của người
khác.

### Test 4 — RBAC: role không có quyền `timesheet:create` (kỳ vọng 403)

Login bằng tài khoản `MANAGER` (permission `timesheet:create` chỉ seed cho
`EMPLOYEE`, không seed cho `MANAGER`):

```bash
TOKEN=$(curl -s http://127.0.0.1:8000/api/auth/login/ -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@worktracker.com","password":"Test1234!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access'])")

curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-18", "hours_spent": "2"}'
```

```text
{"detail":"You do not have permission to perform this action."}
HTTP_STATUS:403
```

✅ Đúng kỳ vọng — `HasPermission` chặn đúng trước khi vào tới `post()`.

## Bảng tổng hợp kết quả

| # | Trường hợp | Status mong đợi | Status thực tế | Kết quả |
|---|---|---|---|---|
| 1 | Tạo log work hợp lệ | 201 | 201 | ✅ |
| 2 | `hours_spent <= 0` | 400 | 400 | ✅ |
| 3 | Log work vào Task của người khác (Data Isolation) | 400 | 400 | ✅ |
| 4 | Role không có quyền `timesheet:create` (RBAC) | 403 | 403 | ✅ |

**Giai đoạn 1 (Log Work cơ bản) hoàn tất** — 4/4 test case đúng kỳ vọng.

## Việc KHÔNG làm trong Giai đoạn 1 này (để khỏi lan phạm vi)

Theo đúng roadmap `08-roadmap-and-talking-points.md`, các phần sau **chưa
đụng tới**, để dành đúng thứ tự Giai đoạn 2-4:

- Time Lock check (Lớp phòng thủ 1).
- 24h-cap + Race Condition qua `select_for_update()` (Lớp phòng thủ 2).
- API Time Lock (chốt sổ kỳ báo cáo).
- Sửa/xóa `log_work` (Giai đoạn 6 — Edge cases).
