# 09 — Xung đột nhánh `LongNguyen`: Vấn đề phát hiện + Kịch bản merge đề xuất

> Bổ sung chi tiết kỹ thuật cho phần "Phần 3" trong
> [08-script-hop-CN-19-07.md](08-script-hop-CN-19-07.md). File đó dùng để
> NÓI trong buổi họp; file này dùng để TRA CỨU khi thực sự bắt tay vào merge.

**Phương pháp kiểm tra:** không suy đoán từ việc đọc code — đã chạy
`git merge-tree --write-tree` (mô phỏng merge thật, git 2.54, không sửa gì)
để lấy danh sách conflict, sau đó tạo nhánh test cục bộ `test_merge1`
(tách từ `TuanTu`, không đụng nhánh chính) và chạy `git merge
origin/LongNguyen` thật để xem đúng nội dung 2 bên trong từng file. Nhánh
`test_merge1` hiện đang ở trạng thái merge dở dang (chưa commit) — dùng để
đối chiếu, có thể `git merge --abort` bất cứ lúc nào.

---

## Phần 1 — Danh sách vấn đề phát hiện được

### 1.1 — 8 file conflict thật (xác nhận bằng cả `merge-tree` lẫn merge thật)

| # | File | Loại | Mức độ |
|---|------|------|--------|
| 1 | `backend/requirements.txt` | content | 🟢 Nhẹ |
| 2 | `backend/accounts/authentication.py` | add/add | 🔴 Nặng |
| 3 | `backend/accounts/models.py` | content | 🔴 Nặng |
| 4 | `backend/worktracker_core/settings.py` | content | 🔴 Nặng |
| 5 | `backend/worktracker_core/urls.py` | content | 🔴 Nặng |
| 6 | `backend/timesheets/views_manager.py` | add/add | 🔴 Nặng nhất |
| 7 | `backend/timesheets/urls_manager.py` | add/add | 🔴 Nặng |
| 8 | `backend/timesheets/serializers_manager.py` | add/add | 🔴 Nặng |

### 1.2 — Chi tiết từng file

**`accounts/authentication.py`** — Bạn có 2 lớp (`BlacklistAwareJWTAuthentication`
chặn token sau logout + `WorkTrackerJWTAuthentication` thêm is_active
cache). Long chỉ có 1 lớp `CachedIsActiveJWTAuthentication` — logic
is_active cache gần giống hệt bạn (đổi tên hằng số), nhưng **thiếu hoàn
toàn lớp blacklist**. Lấy nguyên bản Long = mất tính năng logout thật sự
(token cũ vẫn dùng được sau khi user bấm logout).

> Ghi chú thêm (không phải do merge, review riêng hôm qua): lớp is_active
> cache của CẢ 2 BÊN thực ra là dead weight — `JWTAuthentication.get_user()`
> gốc của SimpleJWT (chạy trong `super().authenticate()`) đã tự check
> `is_active` bằng query DB tươi mỗi request rồi (`CHECK_USER_IS_ACTIVE`
> default `True`, không ai override). Không ảnh hưởng tới quyết định merge,
> nhưng đáng dọn sau.

**`requirements.txt`** — chỉ thêm dependency (`django-redis`, `openpyxl`,
`et_xmlfile`) và bump version (`django-simple-history` 3.11→3.12, `redis`
8.0.0→8.0.1). Không loại trừ nhau — gộp union được ngay, dễ nhất trong 8 file.

**`timesheets/urls_manager.py` + `views_manager.py` + `serializers_manager.py`**
— đây là 3 file cùng 1 câu chuyện, cần đọc chung:
- **Bạn:** ~26 dòng view (`ManagerTimeLockView`, APIView thuần, chỉ làm
  chiều khóa sổ) + 1 serializer, dùng `accounts.permissions.HasPermission`.
- **Long:** 463 dòng, 2 `ViewSet` đầy đủ — `ManagerLogWorkViewSet`
  (list/retrieve/**approve/reject/correct/void**) và
  `ManagerTimeLockViewSet` (list/retrieve/create/**unlock**), route bằng
  `DefaultRouter`, dùng permission (`system.permissions_manager`) và service
  layer (`timesheets.services.logwork_review_manager_service` /
  `timesheets.services.timelock_manager_service`) riêng — không dùng
  `accounts.permissions.HasPermission` của bạn.
- **Đã verify:** `timesheets/models.py` sau khi auto-merge (không conflict)
  **đã có sẵn đủ field** mà code của Long cần — `TimeLock.lock_scope`,
  `TimeLock.job`, `TimeLock.unlocked_by/at`, `TimeLock.unlock_reason`,
  `LogWork.review_status`, `LogWork.reviewed_by/at/note`,
  `LogWork.adjusted_by/at/reason`. Đây chính xác là 2 migration mà file
  [05-cho-minh-anh.md](05-cho-minh-anh.md) đang chờ Minh Anh viết — bên Long
  coi như đã có sẵn tương đương, đóng gói thẳng vào model thay vì migration
  gia tăng. `DailyUserTimesheet` (bảng chống Race Condition của bạn) không
  bị đụng, vẫn còn nguyên.
- **Trả lời luôn câu hỏi FR-124** đang treo ở [00-tong-quan.md](00-tong-quan.md)
  rủi ro #3: Long **đã code xong** review/approve/reject/void, tức phần đó
  đúng là của Long theo v2, không phải bạn code trùng.

**`worktracker_core/urls.py`** — Bạn include đủ `accounts.urls_auth` /
`urls_admin` / `urls_manager` dưới `api/auth/`, cộng `timesheets.urls_manager`
/ `urls_employee` dưới `api/timesheets/`. Long route login/refresh thẳng
bằng `TokenObtainPairView`/`TokenRefreshView` gốc của SimpleJWT (bỏ qua
`LoginView` của bạn hoàn toàn — mất custom claims, mất message chống dò
email, mất `user`/`permissions` payload), route Manager dưới `api/manager/`
trỏ vào `projects`/`tasks`/`timesheets`/`reports`. **Không** include
`accounts.urls_auth`/`urls_admin` — lấy nguyên bản Long sẽ xóa mất toàn bộ
route Admin, logout, forgot/reset/change-password.

**`worktracker_core/settings.py`** — 2 vùng:
1. `INSTALLED_APPS`: chỉ khác 1 dòng cuối cùng (bạn thêm
   `rest_framework_simplejwt.token_blacklist`, Long thêm `reports`) — cần
   giữ **cả 2**, không phải chọn 1 trong 2.
2. Vùng JWT/Redis/Email (nghiêm trọng): bạn có `REST_FRAMEWORK` trỏ
   `WorkTrackerJWTAuthentication` + `SIMPLE_JWT` (lifetime/rotation) +
   `EMAIL_BACKEND` + `REDIS_BLACKLIST_DB` + `CACHES` (db=2, `RedisCache`
   built-in) + `CORS_ALLOWED_ORIGINS`. Long chỉ có `CACHES` (db=1,
   `django_redis`) + `REST_FRAMEWORK` trỏ class của cậu ấy. Lấy nguyên khối
   của Long sẽ: mất `SIMPLE_JWT` (token quay về default của thư viện — access
   token 5 phút, không rotate), mất `EMAIL_BACKEND` (forgot-password vỡ vì
   không có console backend ở dev), mất `REDIS_BLACKLIST_DB` (code
   `redis_client.py:10` đọc `settings.REDIS_BLACKLIST_DB` sẽ ném
   `AttributeError` ngay lúc import), mất `CORS_ALLOWED_ORIGINS` (Frontend
   Vite dev bị trình duyệt chặn CORS hoàn toàn, không gọi API được nữa).

**`accounts/models.py`** — Phần `Role`/`Permission`/`RolePermission` tự
động merge sạch (git không báo conflict vì 2 bên sửa khác dòng nhau) —
⚠️ tự merge sạch không có nghĩa là đúng logic, nên đọc lại tay dù không có
marker. Conflict thật chỉ nằm ở `CustomUser`:
- Bạn có `must_change_password` (Giai đoạn 5 — account lifecycle — phụ
  thuộc field này) nhưng **không có** `Meta.db_table`.
- Long có `CustomUserManager` (validate bắt buộc `role` khi tạo
  superuser), `is_active` khai lại với `db_index=True`,
  `REQUIRED_FIELDS=["role"]`, `Meta.db_table="users"` — nhưng **không có**
  `must_change_password`.
- **Bug có sẵn, phát hiện tình cờ khi đọc conflict (không do merge gây
  ra):** bản của bạn có `REQUIRED_FIELDS = ["username"]`
  (`accounts/models.py:67` trên nhánh `TuanTu` gốc) trong khi `username =
  None` ngay phía trên cùng class (đã xóa field này) — `python manage.py
  createsuperuser` sẽ lỗi vì cố hỏi/set 1 field không tồn tại. Bản của Long
  vô tình đúng hơn (`REQUIRED_FIELDS=["role"]`).
- **Migration trùng số:** `accounts/migrations/` sau merge có 2 file `0002`
  cùng lúc — `0002_seed_roles_permissions.py` (bạn) và
  `0002_alter_customuser_options_alter_customuser_managers_and_more.py`
  (Long, đi qua nhánh MinhAnh). Giống hệt vấn đề đã biết với Minh Anh — git
  không báo lỗi (tên file khác nhau) nhưng Django sẽ vỡ khi `migrate`.

### 1.3 — Vấn đề tầng kiến trúc (không nằm gọn trong 1 file, phải biết trước khi merge)

1. **App layout khác hẳn nhau.** Nhánh bạn: `accounts` / `clients` /
   `jobs` / `audit` / `notifications` / `timesheets`. Nhánh Long: `accounts`
   / `projects` / `tasks` / `reports` / `system` / `timesheets`. Đã xác
   nhận bằng `git log`: commit `ec87153` ("Merge branch 'LongNguyen' ...
   into MinhAnh") cho thấy Minh Anh và Long đã thống nhất kiến trúc app
   này với nhau từ trước, độc lập với bạn.
2. **`clients`/`jobs`/`audit`/`notifications` bên bạn vẫn đang là scaffold
   rỗng** (đã kiểm tra: mỗi `models.py` chỉ 3 dòng, chưa có model thật) —
   nghĩa là **không có việc thật nào bị mất** nếu team quyết định dùng
   `projects`/`system`/`reports` làm nền chính thức thay vì scaffold của
   bạn. Đây là tin tốt — quyết định kiến trúc này rẻ hơn nhiều so với vụ
   `accounts/models.py`.
3. **Nhưng đây vẫn là quyết định của cả team, không tự merge được** — vì
   nếu giữ cả 2 bộ app song song (`jobs` lẫn `projects` cùng tồn tại), sẽ
   có 2 model `Job` khác nhau, và các FK trong tương lai (Task, LogWork,
   TimeLock...) phải chọn trỏ vào đúng 1 bên.

---

## Phần 2 — Kịch bản merge đề xuất

Nguyên tắc chốt (đã thống nhất với bạn trước đó): **Authentication core =
giữ bản của bạn, không thương lượng. Business logic nghiệp vụ Manager
(review/approve/reject/void/unlock log work & time lock) = dùng bản của
Long vì đã hoàn thiện hơn nhiều.**

| File | Quyết định | Việc cần làm thêm |
|------|-----------|-------------------|
| `accounts/authentication.py` | **Giữ bản bạn 100%** | Không cần gì thêm |
| `accounts/models.py` | **Giữ `CustomUser` của bạn** (có `must_change_password`) | Thêm `Meta.db_table="users"` + sửa `REQUIRED_FIELDS=["role"]` (lấy ý hay của Long, không phải merge bắt buộc) + review lại vùng `Role`/`Permission` tự-merge |
| `worktracker_core/settings.py` | **Giữ toàn bộ khối JWT/Redis/Email/CORS của bạn** | Ở `INSTALLED_APPS`: thêm cả `'reports'` lẫn giữ `'rest_framework_simplejwt.token_blacklist'` (cả 2, không phải 1) |
| `worktracker_core/urls.py` | **Giữ toàn bộ route `/api/auth/...` của bạn** | Thêm route Manager mới: `path('api/manager/', include('timesheets.urls_manager'))` (và `projects`/`tasks`/`reports` nếu team đã chốt dùng app đó) — **song song**, không thay thế các route hiện có |
| `timesheets/urls_manager.py` | **Dùng bản của Long** (Router-based, đủ log-works + time-locks) | Xóa `ManagerTimeLockView` cũ của bạn khỏi `views_manager.py`, thay bằng import từ ViewSet mới |
| `timesheets/views_manager.py` | **Dùng bản của Long** | Đổi `permission_classes` từ `system.permissions_manager.*` — cần xác nhận `system` app đã merge đủ (đã kiểm tra: có, merge sạch không conflict) |
| `timesheets/serializers_manager.py` | **Dùng bản của Long** | Không cần sửa gì, model đã có đủ field |
| `requirements.txt` | **Union cả 2** | `pip install -r requirements.txt` lại sau khi gộp, chạy thử `manage.py check` |
| `accounts/migrations/` | Sau khi chốt `models.py` | Bạn viết lại 1 migration `0002` mới hợp nhất (giống cách đã đề xuất với Minh Anh) — không giữ cả 2 file `0002` song song |

### Thứ tự thực hiện đề xuất

1. Resolve `accounts/models.py` trước tiên (mọi file khác phụ thuộc vào
   `CustomUser`).
2. Viết lại migration `accounts` theo đúng thứ tự tuyến tính (gộp với vụ
   Minh Anh luôn — cả 2 người đang đụng cùng 1 vấn đề migration trùng số).
3. Resolve `accounts/authentication.py` + `settings.py` + `urls.py` (đều
   giữ bản bạn, chỉ thêm/không thay).
4. Resolve 3 file `timesheets/*_manager.py` (dùng bản Long).
5. Union `requirements.txt`, `pip install`, chạy `python manage.py check`
   + `makemigrations --check --dry-run` để bắt lỗi sớm trước khi chạy
   `migrate` thật.
6. Chạy thử `curl` cho `POST /api/auth/login/` và
   `GET /api/manager/log-works/` để xác nhận cả 2 phía vẫn sống sau merge.

---

## Phần 3 — Việc còn cần team quyết định (không tự merge được)

1. **Kiến trúc app cuối cùng:** dùng `projects`/`system`/`reports`
   (Minh Anh + Long) làm nền chính thức, xóa scaffold `clients`/`jobs`/
   `audit` của bạn (khuyến nghị — scaffold đang rỗng, không mất gì)?
2. **Ai giữ quyền sở hữu `timesheets` sau merge?** — Long đã code phần
   Manager (`views_manager.py` v.v.), bạn vẫn giữ phần Employee
   (`views_employee.py`, `LogWorkView`, race condition). Cần thống nhất
   ranh giới file rõ ràng để không dẫm chân nhau ở những lần sửa sau.
3. **`accounts/models.py`** — vẫn cần buổi nói chuyện riêng với Minh Anh
   như đã lên kịch bản ở [08-script-hop-CN-19-07.md](08-script-hop-CN-19-07.md)
   Phần 4, vì phần `Role`/`Permission` tự-merge-sạch cần cả 2 người cùng
   review lại, không chỉ đối chiếu với Long.

---

## Trạng thái nhánh test

`test_merge1` (local, tách từ `TuanTu`) đang ở trạng thái merge dở dang,
**chưa commit**, dùng để đối chiếu nội dung — không dùng để merge thật.
Khi bắt tay resolve thật, nên tạo nhánh merge mới từ `TuanTu` mới nhất
(sau khi đã đồng bộ với team), hoặc resolve trực tiếp trên
`test_merge1` rồi review kỹ trước khi mở PR.
