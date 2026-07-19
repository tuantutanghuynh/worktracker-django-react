from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import Role, Permission, RolePermission

MANAGER_PERMISSIONS = [
    # Projects (Jobs)
    ("job:view", "Xem danh sách và chi tiết Job"),
    ("job:create", "Tạo mới Job"),
    ("job:update", "Cập nhật Job (tên, mô tả, deadline)"),
    ("job:change_status", "Chuyển đổi trạng thái Job"),

    # Tasks
    ("task:view", "Xem danh sách Task và Kanban"),
    ("task:create", "Tạo mới Task"),
    ("task:update", "Cập nhật Task (tên, ưu tiên, deadline)"),
    ("task:change_status", "Đổi trạng thái Task (Kanban)"),
    ("task:review", "Duyệt (Approve) hoặc Từ chối (Reject) kết quả Task"),
    ("task:cancel", "Hủy Task"),
    ("task:comment", "Bình luận trong Task"),
    ("task:attachment", "Quản lý file đính kèm Task"),
    ("task:follow", "Quản lý người theo dõi Task"),

    # Timesheets
    ("timesheet:view", "Xem lịch sử Log Work"),
    ("timesheet:review", "Duyệt (Approve) hoặc Từ chối (Reject) Log Work"),
    ("timesheet:correct", "Sửa số giờ Log Work"),
    ("timesheet:void", "Vô hiệu hóa Log Work"),
    ("timelock:view", "Xem danh sách kỳ công đã khóa"),
    ("timelock:lock", "Khóa kỳ công (Time Lock)"),
    ("timelock:unlock", "Mở khóa kỳ công"),

    # Reports
    ("report:view", "Xem Báo cáo và Dashboard"),
    ("report:export", "Xuất báo cáo (XLSX, PDF)"),
]

class Command(BaseCommand):
    help = "Khởi tạo (Seed) dữ liệu quyền cơ bản cho Role MANAGER"

    def handle(self, *args, **kwargs):
        self.stdout.write("Bắt đầu khởi tạo dữ liệu quyền cho Manager...\n")
        
        with transaction.atomic():
            # 1. Đảm bảo Role MANAGER tồn tại
            manager_role, created = Role.objects.get_or_create(
                code="MANAGER",
                defaults={"name": "Manager", "description": "Quản lý dự án / Quản lý cấp trung"}
            )
            if created:
                self.stdout.write(self.style.SUCCESS("Đã tạo Role mới: MANAGER"))
            else:
                self.stdout.write("Role MANAGER đã có sẵn.")

            # 2. Bơm danh sách Permissions
            permission_objects = {}
            for code, name in MANAGER_PERMISSIONS:
                perm, p_created = Permission.objects.get_or_create(
                    code=code,
                    defaults={"name": name}
                )
                permission_objects[code] = perm
                if p_created:
                    self.stdout.write(self.style.SUCCESS(f"  + Tạo Permission mới: {code}"))

            # 3. Nối Permissions vào Role MANAGER
            existing_role_perms = set(
                RolePermission.objects.filter(role=manager_role).values_list('permission__code', flat=True)
            )
            
            added_count = 0
            for code, perm in permission_objects.items():
                if code not in existing_role_perms:
                    RolePermission.objects.create(role=manager_role, permission=perm)
                    added_count += 1
            
            if added_count > 0:
                self.stdout.write(self.style.SUCCESS(f"\nĐã cấp mới {added_count} quyền cho Role MANAGER."))
            else:
                self.stdout.write("\nRole MANAGER đã có đủ các quyền này, không cần cấp thêm.")

        self.stdout.write(self.style.SUCCESS("\nHoàn tất khởi tạo phân quyền Manager!"))
