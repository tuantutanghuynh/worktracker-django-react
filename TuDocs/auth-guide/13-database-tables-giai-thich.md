# 13 — 29 bảng trong database thật: bảng nào từ đâu, vì sao tồn tại

File này giải thích chi tiết **toàn bộ 29 bảng** hiện có trong
`worktracker_db` (Postgres), trả lời 3 câu hỏi: bảng nào nằm trong tài
liệu thiết kế gốc, bảng nào do Django tự sinh ra, và bảng nào phát sinh
thêm do quyết định kỹ thuật — kèm lý do cho từng nhóm.

Lệnh dùng để lấy danh sách 29 bảng thật (không suy luận, lấy trực tiếp từ
DB):

```bash
python manage.py dbshell -- -c "\dt"
```

## Nhóm 1 — 18 bảng nghiệp vụ gốc (đúng tài liệu thiết kế)

| Bảng thật (Postgres) | Tên gốc (tài liệu) | App Django |
|---|---|---|
| `accounts_role` | `roles` | accounts |
| `accounts_permission` | `permissions` | accounts |
| `accounts_rolepermission` | `role_permissions` | accounts |
| `accounts_customuser` | `users` | accounts |
| `accounts_passwordreset` | `password_resets` | accounts |
| `accounts_department` | `departments` | accounts |
| `accounts_employeeprofile` | `employee_profiles` | accounts |
| `projects_client` | `clients` | projects |
| `projects_job` | `jobs` | projects |
| `timesheets_timelock` | `time_locks` | timesheets |
| `system_auditlog` | `audit_logs` | system |
| `tasks_task` | `tasks` | tasks |
| `tasks_taskfollower` | `task_followers` | tasks |
| `tasks_taskcomment` | `task_comments` | tasks |
| `timesheets_logwork` | `log_works` | timesheets |
| `timesheets_dailyusertimesheet` | `daily_user_timesheets` | timesheets |
| `timesheets_notification` | `notifications` | timesheets |
| `timesheets_taskattachment` | `task_attachments` | timesheets |

### Vì sao tên bảng có dạng `app_model` thay vì đúng tên gốc

Django tự đặt tên bảng theo quy ước `<tên_app>_<tên_model_viết_thường>`
(ví dụ model `Role` trong app `accounts` → bảng `accounts_role`). Đây là
hành vi mặc định, không phải lựa chọn — muốn đổi tên bảng thật khớp 100%
với tài liệu (`roles` thay vì `accounts_role`) phải khai báo
`class Meta: db_table = "roles"` trong model, nhưng dự án không làm vậy
(không bắt buộc, chỉ là khác cách gọi tên).

### Điểm lệch đã biết: `notifications` và `task_attachments` nằm sai app

Theo tài liệu, `notifications` thuộc nhóm P5.0 (Notification Hub) và
`task_attachments` gắn với `tasks` (P3.5 Attachment Handler) — nhưng cả 2
đang nằm trong app `timesheets` (model viết trong
`timesheets/models.py`). Đây là điểm đã ghi nhận từ trước (không phải
phát hiện mới), không ảnh hưởng tới dữ liệu/logic, chỉ ảnh hưởng tới việc
"app nào chứa file nào" khi áp dụng "3 Quy tắc vàng để ghép code vô trùng
100%" sau này.

## Nhóm 2 — 4 bảng lõi Django (bắt buộc có ở MỌI project Django)

| Bảng | Vai trò | Đến từ app nào trong `INSTALLED_APPS` |
|---|---|---|
| `django_migrations` | Ghi lại migration nào đã chạy, theo thứ tự | (Django core, không qua app cụ thể) |
| `django_content_type` | Hạ tầng `GenericForeignKey` + Permission framework mặc định | `django.contrib.contenttypes` |
| `django_session` | Lưu session khi đăng nhập qua `/admin/` (khác JWT) | `django.contrib.sessions` |
| `django_admin_log` | Tự ghi log khi ai tạo/sửa/xóa qua trang `/admin/` | `django.contrib.admin` |

### Vì sao 4 bảng này luôn xuất hiện, không liên quan gì tới nghiệp vụ

4 app trên (`contenttypes`, `sessions`, `admin`, và `auth` ở Nhóm 3) đã có
sẵn trong `INSTALLED_APPS` **từ lúc `django-admin startproject` tạo
project** — đây là cấu hình mặc định của mọi project Django, không phải
do bạn chủ động thêm cho WorkTracker. Có thể loại bỏ 1 số app này nếu
không cần (ví dụ bỏ `admin` nếu không dùng trang quản trị Django), nhưng
dự án đang dùng `/admin/` để quản lý dữ liệu test (đã thấy ở các bước
trước), nên giữ nguyên là hợp lý.

### Bảng `django_session` có mâu thuẫn với kiến trúc JWT không?

Không — `django_session` chỉ được dùng khi đăng nhập qua `/admin/`
(Django's session-based admin login), hoàn toàn tách biệt với luồng JWT
bạn xây cho API (`/api/auth/login/`). 2 cơ chế xác thực này chạy song
song, không xung đột: Postman/React gọi API dùng JWT (stateless, không
chạm `django_session`); bạn tự vào `localhost:8000/admin/` bằng tài khoản
superuser dùng session (stateful, có chạm `django_session`).

## Nhóm 3 — 5 bảng phát sinh từ việc `CustomUser` kế thừa `AbstractUser`

| Bảng | Vai trò gốc trong Django |
|---|---|
| `auth_group` | Danh mục "Group" — 1 cách phân quyền mặc định của Django (khác hẳn `roles` bạn tự viết) |
| `auth_group_permissions` | Bảng nối Group ↔ Permission mặc định |
| `auth_permission` | Danh mục Permission **mặc định** của Django (Django tự sinh 4 permission/model: add/change/delete/view) — khác hẳn `accounts_permission` (permission bạn tự định nghĩa, dạng `client:create`) |
| `accounts_customuser_groups` | Bảng nối User ↔ Group (M2M) |
| `accounts_customuser_user_permissions` | Bảng nối User ↔ Permission mặc định (M2M) |

### Cơ chế Django Group/Permission mặc định khác gì RBAC bạn tự viết

Django có **sẵn 1 hệ thống phân quyền** (Group + Permission) hoạt động
độc lập với hệ thống bạn tự thiết kế (`roles`/`permissions`/`role_permissions`):

```text
Hệ thống Django mặc định:        User → Group → Permission (auto: add/change/delete/view <model>)
Hệ thống bạn tự viết (RBAC):     User → Role  → Permission (custom code, "client:create"...)
```

2 hệ thống này **không tự động đồng bộ với nhau** — gán Role "ADMIN" cho 1
user không có nghĩa user đó tự động có Group nào, và ngược lại.

### Vì sao 5 bảng này tồn tại dù không dùng tới

`CustomUser` được định nghĩa là `class CustomUser(AbstractUser):` —
`AbstractUser` (class gốc của Django) có sẵn 2 field:

```python
groups = models.ManyToManyField(Group, ...)
user_permissions = models.ManyToManyField(Permission, ...)
```

Kế thừa `AbstractUser` đồng nghĩa kế thừa luôn 2 field này — Django tự
tạo bảng cho cả 2 (`accounts_customuser_groups`,
`accounts_customuser_user_permissions`) cùng 3 bảng nền của riêng hệ
thống Group/Permission (`auth_group`, `auth_group_permissions`,
`auth_permission`).

### Quyết định đã chốt: giữ nguyên, không xóa

Đã thảo luận trước đó: có thể tắt hẳn bằng cách thêm
`groups = None` và `user_permissions = None` vào `CustomUser` (tương tự
cách `first_name = None`/`last_name = None` đã làm để bỏ field không cần)
— nhưng đã **quyết định giữ nguyên**, vì:

1. 5 bảng dư này không gây lỗi, không ảnh hưởng hiệu năng đáng kể (chỉ
   tốn vài KB dung lượng).
2. Hệ thống RBAC tự viết (`role_permissions`) đã đủ dùng cho toàn bộ logic
   phân quyền thật của dự án — không có chỗ nào trong code đọc/ghi 5 bảng
   này.
3. Việc tắt đi không mang lại lợi ích rõ ràng tương xứng với rủi ro sửa
   (dù nhỏ) vào model `CustomUser` đang chạy ổn định.

## Nhóm 4 — 2 bảng phát sinh từ quyết định kỹ thuật ở Giai đoạn 1 (JWT Rotation)

| Bảng | Vai trò |
|---|---|
| `token_blacklist_outstandingtoken` | Lưu **mọi** refresh token đã từng phát hành (kèm `user`, `jti`, `expires_at`) |
| `token_blacklist_blacklistedtoken` | Lưu refresh token đã bị vô hiệu hóa (sau khi rotate hoặc logout-toàn-thiết-bị) |

### Vì sao 2 bảng này khác hẳn Nhóm 2/3 — đây là lựa chọn chủ động, không phải Django tự sinh mặc định

Khác với Nhóm 2 (luôn có sẵn) và Nhóm 3 (phát sinh do kế thừa
`AbstractUser`), 2 bảng này **chỉ xuất hiện vì bạn chủ động cài thêm app**
`rest_framework_simplejwt.token_blacklist` vào `INSTALLED_APPS` ở Giai
đoạn 1 — để hỗ trợ cấu hình:

```python
SIMPLE_JWT = {
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
```

Khi 1 refresh token được dùng để xin access token mới (gọi
`/api/auth/refresh/`), SimpleJWT cần biết: *"refresh token này đã được
dùng để rotate chưa, có hợp lệ không"*. Để biết được điều đó, nó phải lưu
**lại** mọi token đã phát hành (`OutstandingToken`) và đánh dấu token nào
đã "dùng xong, không cho dùng lại" (`BlacklistedToken`).

### ⚠️ Dễ nhầm: đây KHÔNG phải blacklist Redis của Giai đoạn 2

Đã phân biệt rõ ở `giai-doan-1-log/01-cau-hinh-settings.md`: dự án có
**2 cơ chế blacklist độc lập**, dễ nhầm vì cùng tên "blacklist":

| | `token_blacklist` (Nhóm 4, bảng SQL) | Redis blacklist (Giai đoạn 2) |
|---|---|---|
| Lưu ở đâu | Postgres (bảng thật) | Redis (in-memory) |
| Quản lý bởi | Thư viện `SimpleJWT` tự động | Code tự viết (`LogoutView`, `BlacklistAwareJWTAuthentication`) |
| Theo dõi cái gì | **Refresh token** sau khi rotate | **Access token** sau khi user bấm Logout |
| Vì sao chọn nơi lưu khác nhau | Refresh token sống lâu (7 ngày), không cần tốc độ tra cứu cực nhanh | Access token cần tra cứu ở **mọi request**, phải nhanh (O(1), theo đúng yêu cầu tài liệu gốc) |

## Bảng tổng hợp 29/29

```text
Nhóm 1 — 18 bảng nghiệp vụ gốc
Nhóm 2 —  4 bảng lõi Django (contenttypes, sessions, admin, migrations)
Nhóm 3 —  5 bảng từ AbstractUser (Group/Permission mặc định, không dùng)
Nhóm 4 —  2 bảng token_blacklist (JWT Refresh Rotation, Giai đoạn 1)
─────────────────────────────────────────────────────────────────────
Tổng    = 18 + 4 + 5 + 2 = 29 bảng ✅ khớp đúng `\dt` thật
```

## Câu hỏi tự kiểm tra

1. Nếu xóa app `rest_framework_simplejwt.token_blacklist` khỏi
   `INSTALLED_APPS` và bỏ `ROTATE_REFRESH_TOKENS`, 2 bảng Nhóm 4 có tự
   mất đi không? Cần làm gì để dọn sạch nếu muốn bỏ hẳn?
2. Một user bị gán `Group` "Editors" qua Django Admin (`/admin/`) — họ có
   tự động có thêm quyền gì trong hệ thống RBAC tự viết
   (`role_permissions`) của dự án không? Vì sao?
3. Giả sử Minh Anh/Đức Long tạo thêm model mới trong app của họ (ví dụ
   `Client`) — model đó có tự sinh thêm bảng nào ở Nhóm 2/3 không, hay chỉ
   sinh đúng 1 bảng `projects_client` ở Nhóm 1? Vì sao khác với
   `CustomUser`?
