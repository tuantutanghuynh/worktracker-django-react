# 🔍 BÁO CÁO KIỂM TRA TOÀN BỘ DỰ ÁN SAU KHI MERGE

> Kiểm tra ngày: 2026-08-03 | Nhánh: `LongNguyen`
> Phạm vi: Toàn bộ backend (6 apps + worktracker_core)

---

## 📊 TỔNG QUAN

| Mức độ | Số lượng |
|--------|----------|
| 🔴 CRITICAL (gây crash hoặc chặn hoàn toàn chức năng) | **7** |
| ⚠️ WARNING (logic sai nhưng không crash ngay) | **12** |
| ℹ️ INFO (code thừa, đặt tên sai, không ảnh hưởng chức năng) | **7** |

---

## 🔴 CRITICAL — Phải sửa ngay, gây lỗi runtime

---

### C1. `accounts/auth/views_auth.py` — Dòng 12
**Nhóm:** TuanTu | **Lỗi:** Cache backend `"blacklist"` không tồn tại

```python
# ❌ Hiện tại:
blacklist_cache = caches["blacklist"]   # settings.py chỉ có cache "default"
```

**Hậu quả:** Khi Django nạp module này → crash ngay lập tức với `InvalidCacheBackendError`. Không thể sử dụng Login/Logout.

**Cách sửa:** Cần thêm cache `"blacklist"` vào `settings.py` CACHES, hoặc đổi thành dùng cache `default`:
```python
from django.core.cache import cache  # dùng default cache
```

> [!IMPORTANT]
> File `accounts/authentication.py` (dòng 18) đang dùng `from django.core.cache import cache` (default cache) để kiểm tra token blacklist. Cần thống nhất 2 file dùng cùng 1 cache.

---

### C2. `accounts/admin/views.py` — Dòng 97
**Nhóm:** MinhAnh | **Lỗi:** `hasattr(user, 'profile')` không bắt được lỗi OneToOneField

```python
# ❌ Hiện tại:
old_dept_id = user.profile.department_id if hasattr(user, 'profile') else None
```

**Hậu quả:** Với user chưa có `EmployeeProfile`, Django quăng `EmployeeProfile.DoesNotExist` (kế thừa `ObjectDoesNotExist`, không phải `AttributeError`). `hasattr()` không bắt được lỗi này → crash 500.

**Cách sửa:**
```python
try:
    old_dept_id = user.profile.department_id
except EmployeeProfile.DoesNotExist:
    old_dept_id = None
```

---

### C3. `accounts/admin/views.py` — Dòng 98
**Nhóm:** MinhAnh | **Lỗi:** `get_or_create` thiếu `full_name` bắt buộc

```python
# ❌ Hiện tại:
profile, _ = EmployeeProfile.objects.get_or_create(user=user)
```

**Hậu quả:** Model `EmployeeProfile` yêu cầu `full_name` (CharField, `blank=False`, `null=False`, không có default). Khi `get_or_create` cố tạo mới → `IntegrityError` từ PostgreSQL.

**Cách sửa:**
```python
profile, _ = EmployeeProfile.objects.get_or_create(
    user=user, defaults={"full_name": user.email}
)
```

---

### C4. `timesheets/employee/views_employee.py` — Dòng 21
**Nhóm:** TuanTu | **Lỗi:** Permission code `"timesheet:create"` không tồn tại

```python
# ❌ Hiện tại:
class EmployeeLogWorkView(APIView):
    required_permission = "timesheet:create"   # Không có trong seed_roles.py
```

**Hậu quả:** Employee gọi `POST /api/timesheets/log-works/` → luôn bị 403 Forbidden vì permission code `"timesheet:create"` chưa được seed vào database.

**Cách sửa:** Kiểm tra `seed_roles.py` xem permission đúng tên gì, rồi sửa lại cho khớp.

---

### C5. `timesheets/employee/views_employee.py` — Dòng 36
**Nhóm:** TuanTu | **Lỗi:** Permission code `"logwork:void"` sai tên

```python
# ❌ Hiện tại:
class EmployeeVoidLogWorkView(APIView):
    required_permission = "logwork:void"   # seed_roles.py dùng "timesheet:void"
```

**Hậu quả:** Employee gọi void log work → luôn bị 403 Forbidden.

**Cách sửa:** Đổi thành `required_permission = "timesheet:void"` cho khớp với `seed_roles.py`.

---

### C6. `timesheets/services/manager_employee_utilization_service.py` — Dòng 84–166
**Nhóm:** LongNguyen | **Lỗi:** Data Leakage — `get_team_workload_summary` bỏ qua `manager_user`

```python
# ❌ Hiện tại: tham số manager_user không được sử dụng
def get_team_workload_summary(manager_user, start_date, end_date):
    employees = CustomUser.objects.filter(role__code="EMPLOYEE", is_active=True)  # Lấy TẤT CẢ employee
```

**Hậu quả:** Manager A có thể thấy dữ liệu workload của nhân viên do Manager B quản lý → vi phạm Data Isolation.

**Cách sửa:** Cần filter employees theo scope của manager (dùng `scoped_team_user_ids(manager_user)` hoặc tương tự).

---

### C7. `system/management/commands/seed_roles.py` — Thiếu permission `notification:view`
**Nhóm:** LongNguyen | **Lỗi:** Thiếu seed permission cho notification

**Hậu quả:** [`system/manager/views_manager.py`](file:///d:/Study/HK2/Final%20Project%20HK2/WORK-TRACKER%20GITHUB/worktracker-django-react/backend/system/manager/views_manager.py) yêu cầu `required_permission = "notification:view"` nhưng `seed_roles.py` không có permission này → Manager gọi API notification → 403 Forbidden.

**Cách sửa:** Thêm `"notification:view"` vào `permissions_data` trong `seed_roles.py` và gán cho role MANAGER.

---

## ⚠️ WARNING — Logic sai, cần sửa nhưng không crash ngay

---

### W1. `timesheets/services/manager_workload_utilization_service.py`
**Nhóm:** Không rõ | **Lỗi:** File trùng lặp 100%

File này là bản copy hoàn toàn giống `manager_employee_utilization_service.py` (167 dòng, byte-for-byte). Không được import ở đâu cả → dead code.

**Cách sửa:** Xóa file `manager_workload_utilization_service.py`.

---

### W2. `projects/admin/serializers.py` — Dòng 40–42
**Nhóm:** MinhAnh | **Lỗi:** Partial update bỏ qua date validation

Khi PATCH chỉ gửi `deadline` mà không gửi `start_date`, `data.get('start_date')` trả về `None` → bỏ qua kiểm tra → cho phép đặt deadline trước start_date.

**Cách sửa:** Fallback về `self.instance.start_date` nếu không có trong data.

---

### W3. `projects/admin/views.py` — Dòng 25–30
**Nhóm:** MinhAnh | **Lỗi:** `ClientViewSet` yêu cầu `client:update` cho thao tác `list`/`retrieve`

User có quyền `client:view` vẫn không thể xem danh sách client.

**Cách sửa:** Map `list`/`retrieve` → `client:view`.

---

### W4. `projects/admin/views.py` — Dòng 98–101
**Nhóm:** MinhAnh | **Lỗi:** `JobViewSet` yêu cầu `job:update` cho `list`/`retrieve`/`destroy`

Tương tự W3 nhưng cho Job.

**Cách sửa:** Map `list`/`retrieve` → `job:view`, `destroy` → `job:delete`.

---

### W5. `accounts/admin/views.py` — Dòng 31–34
**Nhóm:** MinhAnh | **Lỗi:** `UserViewSet` yêu cầu `user:update` cho `list`/`retrieve`

Tương tự W3 nhưng cho User.

**Cách sửa:** Map `list`/`retrieve` → `user:view`.

---

### W6. `accounts/admin/views.py` — Dòng 181–184
**Nhóm:** MinhAnh | **Lỗi:** `DepartmentViewSet` yêu cầu `department:update` cho `list`/`retrieve`

Tương tự W3 nhưng cho Department.

**Cách sửa:** Map `list`/`retrieve` → `department:view`.

---

### W7. `accounts/admin/views.py` — Dòng 149–166
**Nhóm:** MinhAnh | **Lỗi:** `assign_permissions` không xóa Redis cache

Khi Admin cập nhật quyền cho role, cache Redis cũ (`role_permissions:{role.id}`) vẫn giữ giá trị cũ trong 5 phút.

**Cách sửa:** Sau khi cập nhật, gọi `cache.delete(f"role_permissions:{role.id}")`.

---

### W8. `accounts/auth/serializers_auth.py` — Dòng 158–160
**Nhóm:** TuanTu | **Lỗi:** `apply_new_password()` không kiểm tra user is None

Nếu user bị xóa sau khi tạo reset token → `user.set_password(...)` crash với `AttributeError`.

**Cách sửa:** Thêm `if user is None: raise ValidationError(...)`.

---

### W9. `accounts/auth/serializers_auth.py` — Dòng 158–160
**Nhóm:** TuanTu | **Lỗi:** Reset password không xóa cờ `must_change_password`

`ChangePasswordSerializer` có `user.must_change_password = False` nhưng `ResetPasswordSerializer` lại không có → user reset password xong vẫn bị chặn đổi mật khẩu lần nữa.

**Cách sửa:** Thêm `user.must_change_password = False` vào `ResetPasswordSerializer.apply_new_password()`.

---

### W10. `accounts/manager/views_manager.py` — Dòng 57–62
**Nhóm:** LongNguyen | **Lỗi:** Search dùng `filter() | filter()` thay vì `Q` objects

Có thể sinh SQL phức tạp hoặc kết quả trùng lặp.

**Cách sửa:** Dùng `qs.filter(Q(email__icontains=search) | Q(profile__full_name__icontains=search))`.

---

### W11. `system/admin.py` — Dòng 24, 27
**Nhóm:** MinhAnh | **Lỗi:** Default argument dùng `Ellipsis (...)` thay vì `None`

`has_change_permission(self, request, obj=...)` → `bool(...)` = `True` → logic kiểm tra sai.

**Cách sửa:** Đổi `obj=...` thành `obj=None`.

---

### W12. `worktracker_core/settings.py` — Dòng 86 và 203
**Nhóm:** Merge conflict leftover | **Lỗi:** `ASGI_APPLICATION` được khai báo 2 lần

**Cách sửa:** Xóa 1 trong 2 dòng trùng.

---

## ℹ️ INFO — Không ảnh hưởng chức năng, nên sửa cho sạch code

| # | File | Dòng | Mô tả |
|---|------|------|-------|
| I1 | `accounts/auth/serializers_auth.py` | 110 | Lỗi đánh vần: `creat_reset_token` → nên là `create_reset_token` |
| I2 | `tasks/admin.py` | 1–4 | File rỗng, chưa đăng ký model Task vào Django Admin |
| I3 | `tasks/manager/views_manager.py` | 515 | Import `TaskAttachment` thừa (đã import ở đầu file) |
| I4 | `system/manager/views_manager.py` | 8 | Import thừa `manager_job_ids` không được sử dụng |
| I5 | `worktracker_core/wsgi.py` | 7 | Docstring ghi Django 6.0 nhưng dùng Django 5.2.15 |
| I6 | `timesheets/employee/serializers_employee.py` | 100 | Gán trùng `validated_data["user"] = user` 2 lần liên tiếp |
| I7 | `projects/admin/views.py` | 21–22 | `is_active=""` (empty string) bị xử lý sai thành `False` |

---

## 📈 PHÂN BỔ LỖI THEO NHÓM

| Nhóm | 🔴 CRITICAL | ⚠️ WARNING | ℹ️ INFO |
|------|-------------|------------|---------|
| **TuanTu** (Auth/Employee) | 3 (C1, C4, C5) | 2 (W8, W9) | 1 (I1) |
| **MinhAnh** (Admin) | 2 (C2, C3) | 5 (W2, W3, W4, W5, W6, W7, W11) | 1 (I7) |
| **LongNguyen** (Manager) | 2 (C6, C7) | 1 (W10) | 2 (I3, I4) |
| **Chung/Merge** | 0 | 1 (W12) | 3 (I2, I5, I6) |

##  LỖI ĐÃ SỬA 
``
C1-C7 CÁC LỖI QUAN TRỌNG GÂY CRASH
Cả 7/7 lỗi CRITICAL trong full_audit_report.md hiện tại ĐÃ ĐƯỢC SỬA HOÀN TOÀN - PLEASE DOUBLE CHECK!!!

✅ C1: Cache blacklist trong settings.py & views_auth.py
✅ C2: Try-except DoesNotExist trong accounts/admin/views.py
✅ C3: defaults={"full_name": user.email} & department_id trong accounts/admin/views.py
✅ C4: timesheet:create trong views_employee.py & seed_roles.py
✅ C5: timesheet:void trong views_employee.py & seed_roles.py
✅ C6: Scoping Manager Workload trong manager_employee_utilization_service.py
✅ C7: Permission notification:view trong seed_roles.py

LỖI CÒN LẠI W1 - W11 , I1 - I7 MỌI NGƯỜI SẼ SỬA KHI LÀM FRONTEND VÀ UP LÊN NHÁNH MAIN NHÉ. THANKS ALL!