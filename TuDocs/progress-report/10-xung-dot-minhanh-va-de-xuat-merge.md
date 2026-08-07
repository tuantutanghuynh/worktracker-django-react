# 10 — Xung đột nhánh `MinhAnh`: Vấn đề phát hiện + Kịch bản merge đề xuất

> Song song với [09-xung-dot-longnguyen-va-de-xuat-merge.md](09-xung-dot-longnguyen-va-de-xuat-merge.md).
> Dùng chung cách kiểm tra: `git merge-tree` dry-run trước, sau đó merge
> thật trong 1 worktree tách biệt (`test_merge_minhanh`, branch từ `TuanTu`)
> để đọc đúng nội dung 2 bên — không đụng tới `test_merge1` hay nhánh chính.

---

## Phần 1 — Danh sách vấn đề phát hiện được

### 1.1 — 7 file conflict thật

| # | File | Loại | Mức độ |
|---|------|------|--------|
| 1 | `backend/requirements.txt` | content | 🟢 Nhẹ |
| 2 | `backend/accounts/authentication.py` | add/add | 🔴 Nặng |
| 3 | `backend/accounts/models.py` | content | 🟡 Nhẹ hơn tưởng (xem 1.2) |
| 4 | `backend/accounts/permissions.py` | add/add | 🔴🔴 **Nặng nhất — không tương thích kỹ thuật, không phải chỉ là khác thiết kế** |
| 5 | `backend/accounts/urls.py` | add/add | 🔴 Nặng |
| 6 | `backend/accounts/views.py` | content | 🔴 Nặng |
| 7 | `backend/worktracker_core/settings.py` | content | 🔴 Nặng |
| 8 | `backend/worktracker_core/urls.py` | content | 🔴 Nặng |

(`accounts/serializers.py` tự merge sạch, không conflict.)

### 1.2 — Phát hiện quan trọng nhất: `accounts/permissions.py` không phải "khác thiết kế" — mà là **incompatible về mặt kỹ thuật**

Bản của Minh Anh:
```python
class HasPermission(BasePermission):
    def __init__(self, required_permission):
        self.required_permission = required_permission
    def has_permission(self, request, view):
        ...
```
Bà dùng theo kiểu khởi tạo có tham số: `HasPermission('user:create')`, gọi
trực tiếp trong `get_permissions()` của từng ViewSet (thấy rõ trong
`accounts/views.py` của cô ấy).

Bản của bạn: `permission_classes = [HasPermission]` — DRF tự khởi tạo bằng
**0 tham số** (`HasPermission()`), rồi đọc `required_permission` như 1
**class attribute** khai trên view.

**Đây không phải sự khác biệt có thể "chọn 1 trong 2 rồi thôi"** — nếu bản
của Minh Anh thắng, **toàn bộ view trong hệ thống đang dùng đúng convention
chuẩn** (`AdminDisableUserView`, `ManagerTeamEmployeeListView`,
`EmployeeLogWorkView`, `ManagerTimeLockView`, cả `ManagerLogWorkViewSet`
của Long...) sẽ crash `TypeError: __init__() missing 1 required positional
argument` ngay khi DRF cố khởi tạo `HasPermission()` không tham số. Đây là
lỗi sẽ sập **toàn bộ API có permission check** trong cả hệ thống, không
chỉ phần của Minh Anh.

→ Không cần tranh luận "giữ bản ai hợp lý hơn" — bản của bạn là bản **duy
nhất chạy được** với phần còn lại của codebase. Nếu Minh Anh có nhu cầu
dùng permission theo tham số động ở vài chỗ đặc biệt, cần viết thêm 1 class
khác (ví dụ `HasPermissionCode` — Long cũng có 1 class tên gần giống vậy
bên `system.permissions_manager`, đáng xem qua cùng nhau), không sửa
`HasPermission` gốc.

### 1.3 — `accounts/urls.py` + `accounts/views.py`: đúng như nghi ngờ ban đầu

Xác nhận bằng merge thật: Minh Anh viết `UserViewSet`, `RoleViewSet`,
`PermissionViewSet`, `DepartmentViewSet` (đầy đủ, có cả action `lock`/
`unlock` gọi `set_user_active_status` đúng quy tắc) — nhưng **toàn bộ nằm
trong `accounts/views.py` + `accounts/urls.py`** (2 file default dùng
chung, đã comment rõ "không thêm code vào đây") thay vì
`views_admin.py`/`urls_admin.py`/`serializers_admin.py` đã scaffold sẵn
cho cô ấy. Route đăng ký ở `/api/accounts/` (qua
`worktracker_core/urls.py` của cô ấy: `path('api/accounts/',
include('accounts.urls'))`), khác hẳn convention `/api/auth/user/...` bên
bạn.

**Tin tốt:** phần logic nghiệp vụ (`lock`/`unlock` gọi đúng
`set_user_active_status`, dùng `select_related` hợp lý, tách
`UserCreateSerializer` riêng cho action `create`) đều ổn, đáng giữ — chỉ
cần **di chuyển file + đổi cách dùng `HasPermission`** (từ
`HasPermission('code')` sang `permission_classes=[HasPermission]` +
`required_permission = "code"`), không cần viết lại từ đầu.

### 1.4 — `accounts/models.py`: ít nghiêm trọng hơn ban đầu tưởng — thực ra chỉ là 1 thiết kế, không phải 2

Đã so `origin/LongNguyen:accounts/models.py` với
`origin/MinhAnh:accounts/models.py` trực tiếp — **chỉ khác 4 dòng**:
```
> # BẢNG 1: role          (khác 1 chữ trong comment, không đáng kể)
> is_active trên Role
> group trên Permission
> joined_date trên EmployeeProfile
```
Nghĩa là bản `models.py` của Minh Anh **không phải thiết kế độc lập thứ 3**
— nó chính là bản của Long (thừa hưởng qua commit `ec87153` "Merge branch
'LongNguyen' ... into MinhAnh" đã phát hiện hôm qua), cộng thêm đúng 3
field nhỏ. Đây chính xác là 3 ý đã được ghi nhận sẵn trong
[00-tong-quan.md](00-tong-quan.md): *"mình thấy bạn có thêm `is_active` cho
Role với `group` cho Permission, nghe khá hợp lý"* — giờ có thêm
`joined_date` trên `EmployeeProfile` (chưa được nhắc tới trước đó, cũng hợp
lý — ngày vào làm của nhân viên).

→ **Không cần giải quyết `models.py` 2 lần** (1 lần với Long, 1 lần với
Minh Anh). Chỉ cần 1 migration mới duy nhất, cộng dồn: field của Long
(`must_change_password` giữ từ bạn, `CustomUserManager`/`db_table="users"`
lấy từ Long) + 3 field nhỏ của Minh Anh.

### 1.5 — `accounts/authentication.py`

Giống hệt phát hiện với Long — vì cùng chung nguồn gốc `ec87153`. Bản của
Minh Anh chỉ thêm comment tiếng Việt giải thích từng dòng, logic không đổi:
vẫn là `CachedIsActiveJWTAuthentication`, vẫn **thiếu lớp blacklist
logout**. Không có thông tin mới, quyết định giữ nguyên: dùng bản của bạn.

### 1.6 — `worktracker_core/settings.py`

Cùng pattern với Long (mất `SIMPLE_JWT`/`EMAIL_BACKEND`/
`REDIS_BLACKLIST_DB`/`CORS_ALLOWED_ORIGINS` nếu lấy nguyên bản cô ấy) —
nhưng CACHES của Minh Anh dùng `django.core.cache.backends.locmem.LocMemCache`
(cache **trong RAM của từng process**, không phải Redis) — yếu hơn cả bản
của Long, vì nếu chạy nhiều worker (gunicorn) thì mỗi worker có cache riêng,
`set_user_active_status` cập nhật ở worker A không có tác dụng với worker
B/C. Không dùng được cho production.

**Điểm hay đáng cân nhắc lấy (không bắt buộc):** khối `DATABASES` của
Minh Anh đọc **toàn bộ** field từ biến môi trường
(`os.environ.get('DB_NAME')`, `DB_USER`, `DB_HOST`, `DB_PORT`...), trong khi
bản của bạn chỉ đọc `PASSWORD` từ `.env`, còn lại hardcode. Bản của cô ấy
portable hơn (đổi máy/deploy không cần sửa code) — có thể áp dụng độc lập
với chuyện merge, không liên quan tới xung đột.

### 1.7 — `worktracker_core/urls.py`

Cùng kiểu bypass `LoginView` bằng `TokenObtainPairView`/`TokenRefreshView`
gốc như Long — nhưng dùng tiền tố **khác cả 2 người kia**:
`api/v1/auth/login/` (có `v1`, không ai khác dùng tiền tố này). Route Admin
của cô ấy nằm ở `api/projects/`, `api/accounts/`, `api/system/`. Tổng cộng
hiện có **3 quy ước tiền tố route khác nhau** giữa 3 người:
- Bạn: `api/auth/...`
- Long: `api/manager/...`
- Minh Anh: `api/v1/auth/...`, `api/projects/...`, `api/accounts/...`,
  `api/system/...`

Đây là việc cần cả 3 người ngồi lại thống nhất 1 lần cho xong, không chỉ là
chuyện merge kỹ thuật.

### 1.8 — `requirements.txt`

Trivial — bạn đã có version mới hơn ở cả 2 gói trùng
(`djangorestframework_simplejwt` 5.5.1 vs 5.5.0, `django-simple-history`
3.11.0 vs 3.8.0). `Django==5.2.15` giống nhau ở cả 2 bên, không xung đột
(dù comment trong `settings.py` ghi "Generated ... using Django 6.0.6" —
chỉ là comment sinh tự động lúc chạy `startproject`, không phản ánh version
thật sự đang cài).

---

## Phần 2 — Kịch bản merge đề xuất

| File | Quyết định | Việc cần làm thêm |
|------|-----------|-------------------|
| `accounts/authentication.py` | **Giữ bản bạn** | Không cần gì thêm |
| `accounts/permissions.py` | **Bắt buộc giữ bản bạn** — lý do kỹ thuật, không phải sở thích | Nếu Minh Anh cần permission theo tham số động, viết class mới riêng, không sửa `HasPermission` |
| `accounts/models.py` | **Giữ `CustomUser` của bạn + field Long** (đã chốt ở file 09) | Cộng thêm 3 field của Minh Anh (`Role.is_active`, `Permission.group`, `EmployeeProfile.joined_date`) vào **cùng 1 migration mới** — không tách riêng |
| `accounts/urls.py`, `accounts/views.py` | Giữ file default rỗng như hiện tại | Minh Anh **di chuyển** `UserViewSet`/`RoleViewSet`/`PermissionViewSet`/`DepartmentViewSet` sang `views_admin.py`/`urls_admin.py`/`serializers_admin.py`, đổi cách dùng `HasPermission` sang class-attribute style |
| `worktracker_core/settings.py` | **Giữ toàn bộ khối JWT/Redis/Email/CORS của bạn** | Cân nhắc (không bắt buộc) đổi `DATABASES` sang đọc từ env đầy đủ như gợi ý của Minh Anh |
| `worktracker_core/urls.py` | **Giữ route `/api/auth/...` của bạn** | Cả 3 người thống nhất 1 quy ước tiền tố chung (đang có 3 kiểu khác nhau) trước khi thêm route mới |
| `requirements.txt` | **Lấy version mới hơn** (đã là bản của bạn) | Không cần đổi gì |

### Điểm khác với kịch bản Long (file 09)

`accounts/models.py` giờ chỉ cần giải quyết **1 lần** cho cả 2 người (vì
cùng chung gốc) — không phải làm 2 migration riêng biệt. Việc cần chốt
trước tiên với Minh Anh không phải `models.py` nữa (đã gần như xong), mà là
**`permissions.py`** (lý do kỹ thuật, ưu tiên cao nhất) và **vị trí code**
(`views.py`/`urls.py` → phải chuyển sang `_admin.py`).

---

## Trạng thái nhánh/worktree test

Đã tạo branch `test_merge_minhanh` (từ `TuanTu`) và merge thật
`origin/MinhAnh` vào trong 1 **worktree riêng** (thư mục tách biệt khỏi
repo chính, không đụng `test_merge1` hay working tree hiện tại của bạn) để
đọc nội dung conflict — merge vẫn đang dở dang, chưa commit. Không dùng để
merge thật, chỉ để đối chiếu.
