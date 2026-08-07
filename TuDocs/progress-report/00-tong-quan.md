# Báo cáo tiến độ — Phần Tuấn Tú (Authentication + Employee)

> **Ngày báo cáo:** 08/07/2026 (cập nhật lần gần nhất: 18/07/2026)
> **Người báo cáo:** Tăng Huỳnh Tuấn Tú  
> **Nhánh làm việc:** `TuanTu`  
> **Trách nhiệm:** Authentication (shared infra) + Employee experience  
> **Deadline code-complete toàn nhóm:** 06/08/2026

---

## Cập nhật 18/07/2026 — Tuần 3 (mốc CN 19/07)

Từ báo cáo 08/07 tới nay, đã hoàn thành gần hết phần lõi bắt buộc của
`timesheets` (app khó nhất về mặt kỹ thuật — Race Condition + Pessimistic
Locking). Chi tiết đầy đủ từng giai đoạn (bug thật + code + test thật) nằm
ở `TuDocs/timesheet-guide/giai-doan-1-log/` đến `giai-doan-3-log/`.

**Đã xong (mới từ 08/07):**
- Sửa lỗi cấu hình chặn server: `INSTALLED_APPS` gõ nhầm `'notification'`
  (thiếu "s") khiến `manage.py` không chạy được; đồng thời đăng ký 3 app
  mới `audit`/`clients`/`jobs` (scaffold sẵn cho Minh Anh).
- **Timesheets Giai đoạn 1** — Log Work API cơ bản, có Data Isolation
  (Employee chỉ log work vào Task của chính mình).
- **Timesheets Giai đoạn 2** — Daily 24h Cap + Race Condition, dùng
  `transaction.atomic()` + `select_for_update()` (Pessimistic Locking) —
  đã test bằng 2 request `curl` chạy song song **thật sự**, không giả lập.
- **Timesheets Giai đoạn 3** — API `ManagerTimeLockView` (Manager chốt sổ
  kỳ báo cáo). Chỉ làm chiều khóa, chưa làm Unlock (cần team chốt trước).
- **Timesheets Giai đoạn 4** — Gắn Time Lock check vào Log Work (Lớp phòng
  thủ 1, chạy trước Lớp phòng thủ 2).

**2 API mới, endpoint thật:**
```text
POST /api/timesheets/log-works/    (EMPLOYEE, quyền timesheet:create)
POST /api/timesheets/time-locks/   (MANAGER, quyền timesheet:lock)
```

**Còn thiếu / rủi ro cần team biết trước CN mai** (xem chi tiết ở mục
"Rủi ro" bên dưới): Frontend Employee (0% — chưa có 1 trang nào ngoài
Auth), Celery chưa cài, Profile API chưa có, P7.3 KPI chưa đụng tới.

---

## Tổng quan tiến độ

| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| **Backend — Giai đoạn 1:** Login / Refresh JWT | ✅ Hoàn thành | Tuần 1 |
| **Backend — Giai đoạn 2:** Logout + Redis Blacklist | ✅ Hoàn thành | Tuần 1 |
| **Backend — Giai đoạn 3:** RBAC (HasPermission) + seed quyền | ✅ Hoàn thành | Tuần 1 |
| **Backend — Giai đoạn 4:** Forgot / Reset Password | ✅ Hoàn thành | Tuần 1 |
| **Backend — Giai đoạn 5:** must_change_password gate | ✅ Hoàn thành | Tuần 1 |
| **Frontend — Auth Kit:** Zustand, Axios, Guards, Pages | ✅ Hoàn thành | Tuần 1 |
| **Backend — Notification Hub:** hàm `notify()` | 🟡 Một phần | Hàm dùng chung đã có (`notifications/utils.py`), chưa có API list/mark-as-read cho Employee |
| **Backend — Profile API:** GET/PATCH profile | 🔲 Chưa làm | Trễ so với Tuần 2 |
| **Backend — Celery + Redis broker** | 🔲 Chưa cài | Trễ so với Tuần 2 — `requirements.txt` chưa có `celery` |
| **Backend — Timesheets:** LogWork + Race Condition | ✅ Hoàn thành | Giai đoạn 1-2, test race condition thật |
| **Backend — Timesheets:** TimeLock API + check | ✅ Hoàn thành | Giai đoạn 3-4 |
| **Backend — P7.3 Employee KPI** | 🔲 Chưa làm | Trễ so với Tuần 3 |
| **Frontend — Employee Layout + Profile page** | 🔲 Chưa làm | Trễ so với Tuần 2 — **rủi ro cao nhất hiện tại** |
| **Frontend — My Tasks, Log Work form** | 🔲 Chưa làm | Trễ so với Tuần 3 |

---

## Rủi ro cần báo với team trước CN mai

1. **Frontend Employee = 0%** trong khi đã hết 3/5 tuần. Backend timesheet
   (phần khó nhất — Race Condition) đã xong, nhưng chưa có UI nào để demo
   luồng Log Work/Time Lock. Ưu tiên tuần tới: Layout Employee + Log Work
   form trước, Celery/Profile/KPI dồn sang Tuần 4.
2. **`views_manager.py`/`urls_manager.py` trong app `timesheets` giờ dùng
   chung với Đức Long** — mình vừa thêm `ManagerTimeLockView` vào đó
   (`timesheets/views_manager.py:17`, đã
   comment rõ ranh giới `# --- Tuấn Tú's section ---`), anh ấy sẽ thêm
   `ReviewLogWorkView` vào cùng file. Cần báo trước để anh ấy `git pull`
   nhánh mới nhất trước khi bắt đầu viết, tránh conflict lúc merge. (Lưu ý:
   nhánh làm việc thật của anh ấy là `LongNguyen`, không phải `DucLong` —
   xem mục "Rủi ro NGHIÊM TRỌNG" bên dưới.)
3. **Giai đoạn 5 gốc của roadmap timesheet (Timesheet Review filter phía
   Manager) khả năng đã trùng phạm vi với Đức Long** theo yêu cầu v2
   (FR-124 — Manager review/approve/reject/void log work). Cần xác nhận
   với Đức Long trước khi ai code trùng việc.
4. **Model `Notification` thật đang nằm trong `timesheets/models.py`**,
   không phải trong app `notifications` vừa scaffold (còn rỗng) — cần dọn
   lại cho nhất quán, nhưng chưa cấp bách (không chặn ai).
5. **Câu hỏi nghiệp vụ chưa chốt**: có cần API Unlock (mở lại kỳ báo cáo đã
   khóa) không? Admin có override được Time Lock không?

---

## ⚠️ Rủi ro NGHIÊM TRỌNG mới phát hiện (18/07) — Xung đột thiết kế với Minh Anh

Trước khi merge Chủ Nhật, đã thử so sánh nhánh của mình với `origin/MinhAnh`
và `origin/DucLong` (`git diff --name-only origin/main...<nhánh>`) để lường
trước xung đột. Đây là mức độ rủi ro **cao hơn cả việc Frontend Employee
chưa làm** — cần thảo luận trực tiếp với team trước khi bất kỳ ai bấm merge,
không giải quyết được chỉ bằng git.

### 1. Nhánh `DucLong` đang RỖNG — nhánh việc thật của Đức Long là `LongNguyen`

`git diff origin/main...origin/DucLong` ra rỗng (không khác `main`). Toàn
bộ việc thật của anh ấy (`projects/*_manager.py`, app `reports` mới, service
layer báo cáo...) nằm ở nhánh `origin/LongNguyen` (tên cũ, chưa đổi theo quy
ước `MinhAnh`/`DucLong`/`TuanTu`). Khi review/merge, phải dùng đúng
`LongNguyen`, không phải `DucLong`.

### 2. Minh Anh đã viết đè lên `accounts/models.py`/`permissions.py`/`serializers.py`/`urls.py`/`views.py`

Đã đối chiếu lại với chính file roadmap của cô ấy
(`project-roadmap/01-phase-minh-anh-admin.md`) để chắc chắn không nhớ nhầm —
file này chia rõ 2 việc khác nhau:

- **Đã giao cho cô ấy**: viết API/UI Admin gán quyền cho user (tạo user,
  gán Role) — đúng vào `accounts/views_admin.py`/`serializers_admin.py`/
  `urls_admin.py` (khung đã scaffold sẵn), class gắn tiền tố `Admin` (ví dụ
  `AdminCreateUserView`).
- **KHÔNG giao** — trích nguyên văn chính file của cô ấy: *"Không đụng vào
  (phần lõi Tuấn Tú giữ, cần thống nhất trước khi sửa):
  `accounts/models.py`, `accounts/permissions.py`,
  `accounts/authentication.py`, `accounts/redis_client.py`."*

Diff thật cho thấy **2 vi phạm cùng lúc**: (1) sửa thẳng vào
`models.py`/`permissions.py` — đúng phần tài liệu ghi rõ không được đụng;
(2) code còn nằm ở file mặc định `views.py`/`urls.py`/`serializers.py`,
**không dùng** `views_admin.py`/`urls_admin.py`/`serializers_admin.py` đã
scaffold sẵn cho cô ấy — nghĩa là cô ấy code song song, chưa theo đúng khung
đã thống nhất. `models.py` giờ có 2 thiết kế khác nhau cho cùng 1 bảng lõi
(thêm `CustomUserManager`, đổi `Meta.db_table`, thêm field mới vào
`Role`/`Permission`, đổi `related_name`...) — không thể tự động merge (git
sẽ conflict gần như mọi dòng nếu cố merge trực tiếp).

### 3. Trùng số migration trong `accounts/migrations/` — Git không báo lỗi, nhưng Django sẽ vỡ

```text
Tuấn Tú:    0002_seed_roles_permissions.py
            0003_add_employee_view_permission.py
            0004_customuser_must_change_password.py

Minh Anh:   0002_alter_customuser_options_alter_customuser_managers_and_more.py
            0003_alter_customuser_id_alter_department_id_and_more.py
            0004_employeeprofile_joined_date_permission_group_and_more.py
```

Tên file khác nhau nên Git merge được bình thường (không xung đột) — nhưng
Django sẽ có 2 nhánh migration `0002` cùng dựa trên `0001_initial`, phá vỡ
tính tuyến tính bắt buộc. `manage.py migrate` sẽ lỗi hoặc cần
`makemigrations --merge` thủ công. Lỗi này **không lộ ra qua git**, chỉ lộ
khi chạy `migrate` thật sau khi merge.

### 4. Khái niệm `Notification` giờ trùng lặp ở 3 nơi

`system/migrations/0003_notification_alter_auditlog_user_and_more.py` của
Minh Anh cho thấy cô ấy **cũng có model `Notification` riêng** (trong app
`system`). Cộng với việc `Notification` thật của mình đang tạm nằm trong
`timesheets/models.py` (chưa dọn sang app `notifications` rỗng) — hiện có
3 nơi khác nhau liên quan notification, cần chốt 1 nơi duy nhất.

### Đánh giá — nên giữ thiết kế của ai, vì sao

**Đề xuất: giữ nguyên thiết kế hiện tại của Tuấn Tú làm nền**, Minh Anh đề
xuất field/ý tưởng cần thêm, Tuấn Tú viết migration mới bổ sung — không
thay cả file. 3 căn cứ:

1. **Team đã quyết định bằng văn bản từ 28/06** —
   `project-roadmap/00-tong-quan.md` giao rõ `roles`/`permissions`/`users`
   cho Tuấn Tú, kèm sẵn script trả lời "sao không phải Minh Anh": đã code +
   test xong 4 giai đoạn trước, tránh 2 người cùng sửa 1 app, phần UI/API
   riêng của Admin vẫn là việc của Minh Anh nhưng không đụng
   `models.py`/`permissions.py`.
2. **Code đã tích hợp + test thật luôn thắng bản viết lại chưa kiểm chứng**
   — thiết kế của Tuấn Tú là nền cho `HasPermission`, JWT claims, Data
   Isolation của Log Work, permission check của Time Lock... tất cả đã test
   qua nhiều giai đoạn. Đổi sang thiết kế Minh Anh nghĩa là phải test lại
   toàn bộ chuỗi đó — phạm vi ảnh hưởng (blast radius) lớn hơn nhiều so với
   chiều ngược lại (Minh Anh chỉ cần viết lại phần API Admin của cô ấy).
3. **Migration `0002`-`0004` của Tuấn Tú đã chạy thật trên Postgres, có data
   thật** (roles/permissions đã seed, vừa dùng để test Log Work/Time Lock)
   — đúng luật nhóm tự đặt "không sửa migration đã chạy".

**Không có nghĩa thiết kế Minh Anh vô giá trị** — vài ý đáng lấy qua
migration mới: `CustomUserManager.create_superuser()` tự validate bắt buộc
có `role` (an toàn hơn), `is_active` trên `Role` (soft-delete role), `group`
trên `Permission` (tiện nhóm hiển thị UI Admin).

**Hành động đề xuất cho họp CN mai**: không tự ý merge/ghi đè phần
`accounts` lõi. Đề nghị Minh Anh giữ nguyên `models.py` hiện tại, báo cụ thể
field nào cô ấy cần thêm, Tuấn Tú viết migration mới bổ sung.

---

## Kiến trúc tổng thể phần Auth

> **Source:** `accounts/authentication.py:58` (`WorkTrackerJWTAuthentication`);
> `accounts/permissions.py:12` (`HasPermission`).

```
HTTP Request
    │
    ▼
WorkTrackerJWTAuthentication   ← accounts/authentication.py
    │  1. Xác thực chữ ký JWT (SimpleJWT)
    │  2. Kiểm tra jti có bị blacklist Redis không (Logout)
    │  3. Kiểm tra is_active qua Redis cache (Account Lock)
    │
    ▼  result: (user, token) hoặc AuthenticationFailed 401
    │
HasPermission                  ← accounts/permissions.py
    │  4. Kiểm tra must_change_password → 403 nếu True
    │  5. Kiểm tra role.permissions → 403 nếu thiếu quyền
    │
    ▼  result: được phép hoặc PermissionDenied 403
    │
View logic                     ← views_auth.py / views_admin.py / ...
```

---

## Bảng dữ liệu thuộc trách nhiệm Tuấn Tú

```
accounts app:
  roles                  — Danh mục vai trò (ADMIN, MANAGER, EMPLOYEE)
  permissions            — Danh mục quyền hành động (client:create, ...)
  role_permissions       — Bảng trung gian Role ↔ Permission
  users (CustomUser)     — Tài khoản đăng nhập
  password_resets        — Token quên mật khẩu
  departments            — Phòng ban
  employee_profiles      — Hồ sơ nhân viên

timesheets app:
  time_locks             — Chốt sổ kỳ báo cáo
  log_works              — Nhật ký giờ làm
  daily_user_timesheets  — Tổng hợp giờ mỗi ngày (chống Race Condition)

notifications app:
  notifications          — Trung tâm thông báo (⚠️ model thật hiện đang
                            nằm tạm trong timesheets/models.py, chưa dọn
                            sang app notifications — xem mục Rủi ro)
```

---

## Danh sách API đã có (production-ready)

| Method | Endpoint | Quyền | Chú thích | Source |
|--------|----------|-------|-----------|--------|
| POST | `/api/auth/login/` | Public | Trả access + refresh + user payload | `accounts/views_auth.py:24` |
| POST | `/api/auth/logout/` | IsAuthenticated | Blacklist jti trong Redis | `accounts/views_auth.py:37` |
| POST | `/api/auth/refresh/` | Public | SimpleJWT standard | `accounts/urls_auth.py:11` |
| POST | `/api/auth/forgot-password/` | Public | Gửi token qua email | `accounts/views_auth.py:59` |
| POST | `/api/auth/reset-password/` | Public | Đổi password bằng token | `accounts/views_auth.py:82` |
| POST | `/api/auth/change-password/` | IsAuthenticated | Đổi password khi đã login | `accounts/views_auth.py:95` |
| POST | `/api/auth/user/<id>/disable/` | `user:disable` | ADMIN disable user | `accounts/views_admin.py:17` |
| GET | `/api/auth/team/employees/` | `employee:view_team` | MANAGER xem team | `accounts/views_manager.py:15` |
| POST | `/api/timesheets/log-works/` | `timesheet:create` | EMPLOYEE log giờ làm — check Time Lock + 24h Cap + Data Isolation | `timesheets/views_employee.py:15` |
| POST | `/api/timesheets/time-locks/` | `timesheet:lock` | MANAGER chốt sổ kỳ báo cáo (chỉ chiều khóa) | `timesheets/views_manager.py:17` |

---

## Các file series chi tiết

- [01-backend-auth.md](01-backend-auth.md) — Giải thích chi tiết 5 giai đoạn backend
- [02-kien-truc-jwt-redis-rbac.md](02-kien-truc-jwt-redis-rbac.md) — Kiến thức nền JWT, Redis, RBAC
- [03-accounts-app-dung-chung.md](03-accounts-app-dung-chung.md) — Quy tắc viết code trong app `accounts`
- [04-frontend-auth-kit.md](04-frontend-auth-kit.md) — Cách dùng auth kit Frontend
- [05-cho-minh-anh.md](05-cho-minh-anh.md) — Hướng dẫn tích hợp dành cho Minh Anh
- [06-cho-duc-long.md](06-cho-duc-long.md) — Hướng dẫn tích hợp dành cho Đức Long
- [07-api-reference.md](07-api-reference.md) — Format request/response đầy đủ cho từng API
- [08-script-hop-CN-19-07.md](08-script-hop-CN-19-07.md) — Script nói chuyện với team, họp CN 19/07/2026
- [09-xung-dot-longnguyen-va-de-xuat-merge.md](09-xung-dot-longnguyen-va-de-xuat-merge.md) — Chi tiết kỹ thuật 8 file conflict với nhánh LongNguyen + kịch bản merge đề xuất
- [10-xung-dot-minhanh-va-de-xuat-merge.md](10-xung-dot-minhanh-va-de-xuat-merge.md) — Chi tiết kỹ thuật 7 file conflict với nhánh MinhAnh + kịch bản merge đề xuất (có lỗi kỹ thuật nghiêm trọng ở `permissions.py`)
- [11-tong-hop-xung-dot-va-ke-hoach-merge-toi-uu.md](11-tong-hop-xung-dot-va-ke-hoach-merge-toi-uu.md) — **Tổng hợp 09+10**, kịch bản merge tối ưu xử lý cả 2 nhánh cùng lúc (đọc file này trước nếu chỉ có thời gian đọc 1 file)
