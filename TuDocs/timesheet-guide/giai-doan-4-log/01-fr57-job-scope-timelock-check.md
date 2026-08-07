# 01 — FR-57: Time Lock check phải phân biệt GLOBAL và JOB

## Vì sao đây là bug thật, không phải thiếu tính năng

Code ở `giai-doan-3-log/02-defensive-layer-1-timelock-check.md`:

```python
lock = TimeLock.objects.filter(
    lock_month=work_date.month, lock_year=work_date.year
).first()
if lock and lock.is_locked:
    raise PermissionDenied(...)
```

Lúc viết, `TimeLock` chỉ có khóa GLOBAL — mỗi `(month, year)` tối đa 1 dòng,
`.first()` an toàn. Sau khi merge model của Đức Long, `TimeLock` có thêm
`lock_scope` (GLOBAL/JOB) + `job` FK, với 2 `UniqueConstraint` riêng:

- `unique_global_lock_per_month`: 1 dòng GLOBAL / `(month, year)`.
- `unique_job_lock_per_month_year`: 1 dòng JOB / `(month, year, job)`.

Nghĩa là cùng 1 `(month, year)` giờ có thể có **nhiều dòng cùng lúc** (1
GLOBAL + N JOB, mỗi job 1 dòng). `.filter(lock_month=, lock_year=).first()`
không lọc `job` → trả về dòng nào đó không xác định thứ tự, có thể đúng,
có thể sai hoàn toàn job đang log work vào.

## Cách sửa: tách 2 query, mỗi query đảm bảo tối đa 1 kết quả

Nhờ 2 `UniqueConstraint` ở trên, DB tự đảm bảo mỗi query dưới đây **không
bao giờ trả về nhiều hơn 1 dòng** — nên `.first()` ở đây an toàn, khác hẳn
bản gốc:

```python
global_lock = TimeLock.objects.filter(
    lock_month=work_date.month,
    lock_year=work_date.year,
    lock_scope=TimeLock.LockScope.GLOBAL,
    job__isnull=True,
).first()

job_lock = TimeLock.objects.filter(
    lock_month=work_date.month,
    lock_year=work_date.year,
    lock_scope=TimeLock.LockScope.JOB,
    job=validated_data["task"].job_id,
).first()
```

## Thứ tự check: GLOBAL trước, JOB sau

Theo đúng roadmap (`project-roadmap/03-phase-tuan-tu-auth-employee.md`,
mục FR-57): check GLOBAL trước vì đây là quyền Admin, "nặng" hơn JOB
(quyền Manager, chỉ 1 dự án). Nếu cả 2 cùng khóa, báo GLOBAL trước — vì dù
Manager mở JOB lock, Employee vẫn bị chặn bởi GLOBAL, báo đúng cái chặn ở
tầng cao hơn tránh hiểu lầm "tưởng hết bị khóa".

Vẫn giữ nguyên bài học cũ từ Giai đoạn 4 gốc: `is_locked=True` phải check
riêng, vì 1 dòng `TimeLock` tồn tại không có nghĩa đang khóa (unlock không
xoá dòng, chỉ set `is_locked=False`).

## Code cuối cùng — `backend/timesheets/serializers_employee.py`

```python
def create(self, validated_data):
    user = self.context["request"].user
    work_date = validated_data["work_date"]
    hours_spent = validated_data["hours_spent"]

    with transaction.atomic():
        # Defensive layer 1 — Time Lock check (GLOBAL trước, rồi JOB)
        global_lock = TimeLock.objects.filter(
            lock_month=work_date.month,
            lock_year=work_date.year,
            lock_scope=TimeLock.LockScope.GLOBAL,
            job__isnull=True,
        ).first()
        if global_lock and global_lock.is_locked:
            raise PermissionDenied(
                f"Period {work_date.month}/{work_date.year} is locked (GLOBAL lock). "
                "Contact your admin to unlock it."
            )

        job_lock = TimeLock.objects.filter(
            lock_month=work_date.month,
            lock_year=work_date.year,
            lock_scope=TimeLock.LockScope.JOB,
            job=validated_data["task"].job_id,
        ).first()
        if job_lock and job_lock.is_locked:
            raise PermissionDenied(
                f"Period {work_date.month}/{work_date.year} is locked for this job (JOB lock). "
                "Contact your manager to unlock it."
            )

        # Defensive layer 2 — 24h Cap + Race Condition (không đổi từ Giai đoạn 2)
        ...
```

`validated_data["task"]` dùng lại được ở đây vì `validate_task()` đã chạy
xong trước `create()` trong luồng DRF — không cần query lại `Task`.

## Verify

`python manage.py check` sạch. Không cần migration (không đổi model, chỉ
đổi logic serializer). Chưa test bằng curl với dữ liệu JOB lock thật (cần
Đức Long tạo JOB lock trước) — chỉ mới verify bằng system check + đọc logic
tay. **Nợ lại**: test tích hợp thật với 1 JOB lock do Manager tạo, khi
Frontend/2 phía đều có dữ liệu.
