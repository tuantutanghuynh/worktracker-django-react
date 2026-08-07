# 01 — Seed dữ liệu `roles`/`permissions`/`role_permissions`

## Vì sao dùng Data Migration, không chèn tay qua shell

Đây là **dữ liệu cấu hình lõi** — hệ thống không hoạt động đúng nếu thiếu,
và mọi người trong team, mọi môi trường (máy bạn, máy đồng nghiệp, CI) đều
cần có **chính xác cùng 1 bộ dữ liệu**. Nếu chèn tay qua shell, mỗi người
phải tự nhớ gõ lại, dễ sai/thiếu. Data Migration giải quyết: chỉ cần chạy
`python manage.py migrate`, dữ liệu này tự động có — đúng cùng cách mọi
migration khác đã chạy từ đầu dự án.

## Code — `0002_seed_roles_permissions.py`

```python
from django.db import migrations

ROLES = [
    {"code": "ADMIN", "name": "Quản trị viên"},
    {"code": "MANAGER", "name": "Quản lý dự án"},
    {"code": "EMPLOYEE", "name": "Nhân viên thực thi"},
]

ROLE_PERMISSIONS = {
    "ADMIN": [
        "client:create", "client:update", "job:create", "job:update",
        "user:create", "user:disable", "audit:view",
    ],
    "MANAGER": [
        "task:create", "task:assign", "task:review",
        "timesheet:lock", "report:view",
    ],
    "EMPLOYEE": [
        "task:view_own", "task:update_own",
        "timesheet:create", "timesheet:update_own",
    ],
}


def seed_data(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    role_objs = {r["code"]: Role.objects.create(code=r["code"], name=r["name"]) for r in ROLES}

    permission_objs = {}
    for perm_codes in ROLE_PERMISSIONS.values():
        for code in perm_codes:
            if code not in permission_objs:
                permission_objs[code] = Permission.objects.create(code=code, name=code)

    for role_code, perm_codes in ROLE_PERMISSIONS.items():
        for code in perm_codes:
            RolePermission.objects.create(role=role_objs[role_code], permission=permission_objs[code])


def remove_data(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    Role.objects.filter(code__in=[r["code"] for r in ROLES]).delete()
    Permission.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]
    operations = [
        migrations.RunPython(seed_data, remove_data),
    ]
```

## Vì sao dùng `apps.get_model()`, không import model trực tiếp

Model thật (`accounts/models.py`) có thể thay đổi cấu trúc trong tương lai
(thêm field, đổi tên...), nhưng file migration phải luôn chạy đúng với
**đúng cấu trúc model tại thời điểm migration được tạo ra**. `apps.get_model()`
trả về "ảnh chụp" lịch sử của model tại đúng thời điểm đó — import trực
tiếp sẽ dùng model hiện tại (có thể đã khác), gây lỗi khó hiểu nếu chạy lại
migration cũ trên model mới.

## `remove_data` dùng để làm gì

Hàm "đảo ngược" — chạy khi ai đó gọi `migrate accounts <migration_trước>`
để rollback. Không bắt buộc hoàn hảo, nhưng nên có để migration không "kẹt
cứng" một chiều khi cần debug.

## Kết quả seed

```text
Roles: 3
Permissions: 16
RolePermissions: 16
ADMIN: ['client:create', 'client:update', 'job:create', 'job:update', 'user:create', 'user:disable', 'audit:view']
MANAGER: ['task:create', 'task:assign', 'task:review', 'timesheet:lock', 'report:view']
EMPLOYEE: ['task:view_own', 'task:update_own', 'timesheet:create', 'timesheet:update_own']
```

## Thêm permission mới SAU KHI đã migrate — migration MỚI, không sửa migration cũ

Khi cần thêm `employee:view_team` cho API mẫu ở Bước 3, **không sửa lại
`0002_seed_roles_permissions.py`** (đã chạy `migrate` rồi). Nguyên tắc:
**một migration đã áp dụng vào DB thì không sửa lại, chỉ thêm migration
mới** — giống hệt nguyên tắc "không `git commit --amend` 1 commit đã
push" đã học ở `giai-doan-2-log`. Sửa migration cũ sẽ làm môi trường đã
chạy (máy bạn) và môi trường chưa chạy (máy đồng nghiệp) lệch nhau.

```python
# 0003_add_employee_view_permission.py
from django.db import migrations


def add_permission(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    manager_role = Role.objects.get(code="MANAGER")
    perm = Permission.objects.create(code="employee:view_team", name="employee:view_team")
    RolePermission.objects.create(role=manager_role, permission=perm)


def remove_permission(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Permission.objects.filter(code="employee:view_team").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_seed_roles_permissions"),
    ]
    operations = [
        migrations.RunPython(add_permission, remove_permission),
    ]
```

Lưu ý `dependencies` trỏ tới `0002_seed_roles_permissions` (migration ngay
trước nó), không phải `0001_initial` — Django dùng chuỗi `dependencies`
này để biết thứ tự chạy migration chính xác.
