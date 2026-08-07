# Giai đoạn 3 — RBAC (Role + Permission): Tổng quan quá trình thực hiện

Bản ghi lại quá trình triển khai **Giai đoạn 3** trong roadmap ở
`auth-guide/08-roadmap-and-talking-points.md`, nối tiếp `giai-doan-2-log/`.
Mục tiêu: chuyển từ "biết user là ai" (Authentication, Giai đoạn 1-2) sang
"user đó được làm gì" (Authorization) — dựa trên dữ liệu `role_permissions`
trong DB, không hardcode trong code.

## Phạm vi đã hoàn thành

- Seed dữ liệu `roles`/`permissions`/`role_permissions` bằng data migration.
- `HasPermission` — DRF Permission class tra cứu quyền theo role của user.
- 2 API mẫu áp dụng `HasPermission`: `AdminDisableUserView` (permission thuần)
  và `ManagerTeamEmployeeListView` (permission + Data Isolation).
- Integration test 4 trường hợp — toàn bộ đạt kết quả mong đợi sau khi sửa
  lại cách chọn test case ở Test 2 (xem file 04).

## Cây file đã tạo/sửa

```text
backend/accounts/
├── migrations/
│   ├── 0002_seed_roles_permissions.py        ← tạo mới
│   └── 0003_add_employee_view_permission.py  ← tạo mới
├── permissions.py                             ← tạo mới: HasPermission
├── views_admin.py                             ← sửa: thêm AdminDisableUserView
├── views_manager.py                           ← sửa: thêm ManagerTeamEmployeeListView
├── urls_admin.py                              ← sửa: thêm route disable user
└── urls_manager.py                            ← sửa: thêm route team employees
```

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-seed-data-migration.md](01-seed-data-migration.md) | Vì sao seed bằng Data Migration, không chèn tay; vì sao thêm permission mới = migration MỚI, không sửa migration cũ |
| 2 | [02-permission-class.md](02-permission-class.md) | `HasPermission`, guard clause cho lỗi lập trình viên, vì sao tự check `is_authenticated` dù đã có default toàn cục |
| 3 | [03-api-mau-va-data-isolation.md](03-api-mau-va-data-isolation.md) | `AdminDisableUserView`, `ManagerTeamEmployeeListView`, các bug đường dẫn file/import/typo đã gặp |
| 4 | [04-testing-va-ket-qua.md](04-testing-va-ket-qua.md) | 4 test case, và phát hiện phụ: tài khoản bị khóa tự bị chặn ở tầng Authentication trước khi tới Permission |

## Nguyên tắc đáng nhớ nhất rút ra từ Giai đoạn 3

1. **Migration đã áp dụng = không sửa lại, chỉ thêm mới** — đúng nguyên tắc
   "không amend 1 git commit đã push", áp dụng tương tự cho migration DB.
2. **Guard clause cho lỗi lập trình viên dùng sai API** (View quên khai báo
   `required_permission`) nên `raise AssertionError` ngay lúc dev/test, thay
   vì âm thầm luôn-cho-qua hoặc luôn-chặn.
3. **Không tin lớp khác đã validate đúng phần của nó** — `HasPermission` tự
   kiểm tra `is_authenticated`, không giả định `IsAuthenticated` chắc chắn
   đã chạy trước.
4. **Authentication chạy trước Authorization, và can thiệp được vào cả 2
   lớp** — tài khoản `is_active=False` bị chặn ngay ở tầng Authentication
   (401), không bao giờ tới được tầng Permission (sẽ là 403) — đây là 1 ví
   dụ thực tế cho thấy thứ tự các lớp trong pipeline xử lý request quan
   trọng như thế nào.
