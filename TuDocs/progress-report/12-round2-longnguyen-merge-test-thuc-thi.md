# 12 — Round 2 với nhánh `LongNguyen`: Merge thật đã chạy, lỗi migration graph phát hiện & sửa

> Tiếp nối [09-xung-dot-longnguyen-va-de-xuat-merge.md](09-xung-dot-longnguyen-va-de-xuat-merge.md)
> (round 1, trước khi thực hiện merge team lần đầu ngày 20/07). Đây là round
> 2, thực hiện ngày 29/07/2026, sau khi nhánh `LongNguyen` đã đi xa thêm 3
> commit kể từ lần merge team đầu tiên (`d8996cf`).

**Phương pháp kiểm tra:** không suy đoán — (1) `git fetch origin LongNguyen`
lấy state mới nhất, (2) `git merge-tree --write-tree` (dry-run, không sửa
gì) lấy danh sách conflict, (3) `git worktree add` + `git branch
test_merge_longnguyen_v2` tạo nhánh test **hoàn toàn tách biệt** khỏi
`TuanTu-2` thật, (4) chạy `git merge origin/LongNguyen` thật trên nhánh test
đó, resolve từng conflict, **rồi verify bằng `manage.py check` +
`makemigrations --check --dry-run`** — bước cuối này chính là thứ dry-run
`merge-tree` không bao giờ phát hiện được, và đã lộ ra 2 lỗi thật.

---

## Phần 0 — Bối cảnh: `LongNguyen` đã tiến xa hơn nhiều

3 commit mới kể từ lần merge trước (`79e1552..6ebd1c2`):

```text
6ebd1c2 Update 27-07-2026  — thêm field Client (address/industry/notes/created_at/updated_at)
43dfcf4 UPDATE README.MD
d16995b update 22-07-2026  — tái cấu trúc app vào manager/ subdir, thêm Celery + Django Channels + pytest
```

Mang theo: **Long tự viết Celery riêng** (đụng thẳng phần vừa làm ở
`giai-doan-5-log`), thêm Django Channels (WebSocket), tái cấu trúc hàng loạt
file `*_manager.py` của `projects`/`reports`/`tasks`/`timesheets` vào thư
mục con `manager/`, dời `system/permissions_manager.py`/`scoping_manager.py`
vào `system/security/`, thêm bộ test `pytest` (`backend/testcase/`).

---

## Phần 1 — 10 file xung đột (xác nhận bằng cả dry-run lẫn merge thật)

| # | File | Loại | Mức độ |
|---|------|------|--------|
| 1 | `backend/requirements.txt` | content | 🟢 Nhẹ |
| 2 | `backend/accounts/models.py` | content | 🟢 Nhẹ (trùng ý tưởng) |
| 3 | `backend/projects/models.py` | content | 🟢 Nhẹ (thuần Long thêm mới) |
| 4 | `backend/system/migrations/0004_auditlog_severity_auditlog_summary.py` | add/add | 🟢 Nhẹ (nội dung giống hệt) |
| 5 | `backend/system/services/notification_manager_service.py` | content | 🟢 Nhẹ (khác chữ trong docstring) |
| 6 | `backend/worktracker_core/__init__.py` | content | 🟢 Nhẹ |
| 7 | `backend/worktracker_core/celery.py` | add/add | 🟢 Nhẹ (logic giống hệt) |
| 8 | `backend/system/tasks.py` | add/add | 🔴 Nặng — 2 bản khác nhau thật |
| 9 | `backend/worktracker_core/settings.py` | content | 🔴 Nặng — có rủi ro Redis DB trùng |
| 10 | `backend/worktracker_core/urls.py` | content | 🔴 Nặng — trùng tính năng Manager thật |

### 1.1 — `system/tasks.py`: 2 bản khác nhau thật (đã quyết: dùng bản Long)

| | Bản của Tuấn Tú | Bản của Long |
|---|---|---|
| Retry | `autoretry_for` exception cụ thể (SMTP/network) | `bind=True` + `self.retry()`, bắt mọi `Exception` |
| Idempotent | ❌ không có | ✅ check `is_sent_email` trước khi gửi |
| Guard user không có email | ❌ không có | ✅ có |
| Logging | ❌ không có | ✅ dùng `logging` module |
| Query | `.get()` rồi mới đọc `.user.email` (2 query) | `.select_related("user")` (1 query) |

Đề xuất ban đầu là 1 bản kết hợp ưu điểm cả 2, nhưng **quyết định cuối:
dùng nguyên bản của Long** — bỏ task `ping` (chỉ là task test hạ tầng, đã
hoàn thành nhiệm vụ ở giai-doan-5-log, không cần giữ trong code thật).

### 1.2 — `worktracker_core/settings.py`: rủi ro Redis DB trùng nếu resolve ẩu

Redis DB đang được cả 2 bên dùng khác nhau:

| DB index | Bên Tuấn Tú | Bên Long |
|---|---|---|
| 1 | JWT blacklist (`redis_client` trực tiếp) | `CACHES` (is_active, qua `django_redis`) |
| 2 | `CACHES` (is_active, Django built-in `RedisCache`) | Celery broker |
| 3 | Celery broker + result | (không dùng — result thật ra đi qua `django-db`, không phải Redis) |

**Nếu lấy nguyên khối của Long**: `CACHES` sẽ đổi sang DB=1 → **đụng thẳng**
`REDIS_BLACKLIST_DB=1` đang có sẵn (mixed keys giữa cache framework và
blacklist thô trong cùng 1 DB Redis, rủi ro cache bị xóa nhầm/đọc nhầm key).
Nếu đồng thời lấy Celery broker của Long ở DB=2 → đụng luôn `CACHES` của
chính Tuấn Tú (DB=2).

**Quyết định**: giữ nguyên topology Redis của Tuấn Tú (blacklist=1, cache=2,
Celery=3) — **không đổi theo số của Long**. Nhưng lấy các setting Celery
khác của Long (`CELERY_RESULT_BACKEND="django-db"` — an toàn hơn vì không
tốn thêm DB Redis nào, cộng `CELERY_CACHE_BACKEND`/`ACCEPT_CONTENT`/
`TASK_SERIALIZER`/`RESULT_SERIALIZER`/`TIMEZONE`/`TASK_TRACK_STARTED`), và
toàn bộ khối `CHANNEL_LAYERS`/`ASGI_APPLICATION` (tính năng mới, không đụng
DB nào đã có chủ). Đồng thời dọn 1 chỗ trùng lặp phát sinh khi auto-merge:
`MEDIA_URL`/`MEDIA_ROOT` bị định nghĩa 2 lần liên tiếp (1 của mỗi bên,
Python không báo lỗi vì gán lại biến hợp lệ, nhưng dư thừa) — giữ đúng 1 bản.

### 1.3 — `worktracker_core/urls.py`: phát hiện trùng tính năng Manager thật

Long đã tự xây thêm (app mới `accounts/manager/`, `system/manager/`):

- `ManagerTeamEmployeeListView` — **trùng tên, khác implementation, khác
  URL path** với bản đã có của Tuấn Tú (`accounts/urls_manager.py`,
  `team/employees/` — bản Long ở `accounts/employees/`).
- `ManagerEmployeeDepartmentUpdateView` — tính năng hoàn toàn mới, Tuấn Tú
  chưa có.
- `ManagerNotificationListView` / `ManagerNotificationMarkReadView` /
  `ManagerNotificationMarkAllReadView` — API Notification riêng cho
  **Manager xem team**, khác phạm vi với API Notification cho **chính mình**
  (`system/views_employee.py`) mà Tuấn Tú vừa xây ở `giai-doan-5-log`.
- `ManagerAuditLogListView` — có thể trùng/chồng lấn với
  `AuditLogViewSet` đã có sẵn của Minh Anh (`system/views_admin.py`).

**Chưa resolve dứt điểm** — mount song song cả 2 bộ route (không route nào
bị xóa) chỉ để merge chạy được và verify tiếp; đây là **quyết định cần cả
team** (Tuấn Tú + Long, có thể cả Minh Anh với phần AuditLog), không tự
merge 1 mình được.

---

## Phần 2 — Lỗi thật chỉ lộ ra khi chạy `makemigrations --check` (không thấy được bằng dry-run)

Sau khi resolve xong cả 10 file, `git commit` merge thành công,
`manage.py check` **sạch**. Nhưng `makemigrations --check --dry-run` báo:

```text
django.db.migrations.exceptions.NodeNotFoundError:
Migration accounts.0003_employeeprofile_joined_date_role_is_active
dependencies reference nonexistent parent node
('accounts', '0002_alter_customuser_options_alter_customuser_managers_and_more')
```

**Nguyên nhân**: migration `accounts/migrations/0003_employeeprofile_joined_date_role_is_active.py`
của Long được sinh dựa trên lịch sử migration **riêng của nhánh Long**
(`0002` = `alter_customuser_options...`) — bên Tuấn Tú, `0002` là 1 migration
hoàn toàn khác (`seed_roles_permissions`, từ đợt merge team trước) và lịch
sử đã đi tới `0006`. Migration của Long trỏ tới 1 node không tồn tại trong
graph của Tuấn Tú → vỡ hoàn toàn, không migrate được app nào cả (Django yêu
cầu toàn bộ graph nhất quán, không riêng app bị lỗi).

**Cách sửa**: đổi số + sửa `dependencies`, giữ nguyên `operations` (nội dung
field `joined_date`/`is_active` không đổi):

```python
# accounts/migrations/0003_...py → đổi tên thành 0007_...py
dependencies = [
    ('accounts', '0006_logwork_void_permission'),   # trước đó trỏ sai '0002_alter_customuser_options...'
]
```

Chạy lại `makemigrations --check` → phát hiện lỗi **thứ 2**, khác loại:

```text
CommandError: Conflicting migrations detected; multiple leaf nodes in the
migration graph: (0003_client_address_client_created_at_client_industry_and_more,
0005_alter_client_id_alter_job_id in projects).
To fix them run 'python manage.py makemigrations --merge'
```

**Nguyên nhân**: đây là lỗi **có sẵn trong chính nhánh Long**, không liên
quan tới việc merge với Tuấn Tú — app `projects` bên Long có 2 nhánh
migration song song cùng bắt đầu từ `0002` (1 nhánh thêm field `Client`, 1
nhánh khác sửa `id`/thêm `Job.priority`) mà chưa ai hợp nhất lại. Vì Tuấn Tú
chưa từng đụng `projects/models.py`, đây hoàn toàn là việc nội bộ của Long,
**nên báo lại cho Long biết** kể cả khi không merge với Tuấn Tú.

**Cách sửa**: dùng thẳng công cụ có sẵn của Django, không tự viết tay:

```bash
python manage.py makemigrations --merge
# → tự sinh backend/projects/migrations/0006_merge_20260729_1011.py
```

Chạy lại `makemigrations --check --dry-run` lần cuối → **"No changes
detected"** — toàn bộ graph (`accounts`, `projects`, `system`, và mọi app
khác) đã nhất quán hoàn toàn.

---

## Phần 3 — Việc còn cần quyết định / kiểm tra thêm (chưa làm trong round này)

1. **`worktracker_core/urls.py`** — thống nhất với Long: giữ
   `ManagerTeamEmployeeListView` nào, có áp dụng
   `ManagerEmployeeDepartmentUpdateView` không, API Notification cho Manager
   của Long có nên tích hợp cùng cơ chế `notify()`/`enqueue_email_best_effort()`
   đã xây ở `giai-doan-5-log` hay tách biệt hoàn toàn, và xác nhận
   `ManagerAuditLogListView` có trùng `AuditLogViewSet` (Minh Anh) không.
2. **Báo Long về lỗi migration nội bộ của `projects` app** (2 nhánh song
   song `0003`) — không phải lỗi do merge, tồn tại độc lập trong nhánh của
   Long, nên anh ấy tự chạy `makemigrations --merge` bên nhánh gốc trước
   khi ai đó merge nữa vào, tránh lặp lại vấn đề.
3. **Chưa chạy `migrate` thật vào Postgres** — dừng lại ở
   `makemigrations --check` (kiểm tra graph nhất quán, không đụng DB thật).
   Chạy `migrate` thật lên `worktracker_db` là bước tiếp theo nếu quyết định
   merge chính thức, nhưng đó là thao tác khó hoàn tác lên DB local, chưa tự
   ý thực hiện.
4. **Chưa merge nhánh test vào `TuanTu-2` thật** — toàn bộ round này chỉ
   nằm trên nhánh test `test_merge_longnguyen_v2`.

---

## Trạng thái nhánh test

- Branch: `test_merge_longnguyen_v2` (tách từ `TuanTu-2` tại commit `7378f79`).
- Worktree riêng (ngoài thư mục project chính, không đụng `runserver`/`celery
  worker` đang chạy ở `TuanTu-2`).
- 2 commit đã tạo trên nhánh test (chỉ local, chưa push):
  1. Merge commit (`72f77e5`) — resolve cả 10 file xung đột.
  2. `92d7203` — "Fix migration graph after merging LongNguyen: renumber
     accounts' dependency-broken migration and merge projects' two leaf
     branches."
- Đã cài `.venv_test` riêng trong worktree (không đụng `.venv` thật của
  `TuanTu-2`) để chạy `manage.py check`/`makemigrations --check`.
- **Chưa merge vào `TuanTu-2`, chưa push lên GitHub** — nhánh test này dùng
  để đối chiếu/tiếp tục sửa, có thể xóa an toàn bất cứ lúc nào
  (`git worktree remove` + `git branch -D test_merge_longnguyen_v2`) nếu
  không cần nữa.
