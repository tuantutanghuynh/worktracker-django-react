# Giai đoạn 1 — Log Work cơ bản: Tổng quan quá trình thực hiện

Đây là bản ghi lại toàn bộ quá trình triển khai **Giai đoạn 1** trong roadmap
ở `timesheet-guide/08-roadmap-and-talking-points.md` — bao gồm câu hỏi, lý
do kỹ thuật, code thật, các lỗi đã gặp và cách sửa. Cùng tinh thần với series
`auth-guide/giai-doan-1-log/`: đây là **nhật ký thực tế đã code**, dùng để
ôn lại và trình bày cho team hiểu chính xác "đã làm gì, vì sao làm vậy, kết
quả ra sao".

## Phạm vi đã hoàn thành

API tạo `log_work` cơ bản cho Employee — theo đúng mô tả "Giai đoạn 1" ở file
`08`: **chưa** có Time Lock check, **chưa** có 24h-cap/Race Condition
(2 thứ đó thuộc Giai đoạn 2-4). Đã có ngay từ giai đoạn này:

- Tạo `log_work` mới qua `POST /api/timesheets/log-works/`.
- Validate `hours_spent > 0`.
- **Data Isolation**: Employee chỉ log work được vào `Task` đang gán cho
  chính họ (`task.assignee == request.user`) — không phải "defensive logic"
  thêm sau, mà là điều kiện đúng/sai cơ bản của tính năng.
- RBAC qua permission `timesheet:create` (đã seed sẵn cho role EMPLOYEE từ
  migration `0002_seed_roles_permissions.py`, không cần migration mới).

Ngoài ra, trước khi code được Giai đoạn 1, phát hiện và sửa 1 lỗi cấu hình
đang chặn toàn bộ server khởi động — xem file `01`.

## Cây file đã tạo/sửa

```text
backend/
├── worktracker_core/
│   ├── settings.py   ← sửa: fix 'notification' → 'notifications', thêm
│   │                    'clients'/'jobs'/'audit' vào INSTALLED_APPS
│   └── urls.py        ← sửa: mount timesheets.urls_employee, dọn dòng
│                          comment bị gõ dở
└── timesheets/
    ├── serializers_employee.py   ← tạo mới: EmployeeLogWorkSerializer
    ├── views_employee.py         ← tạo mới: EmployeeLogWorkView
    └── urls_employee.py          ← tạo mới: route log-works/
```

## Thứ tự đọc các file trong series này

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-fix-settings.md](01-fix-settings.md) | Lỗi `ModuleNotFoundError: No module named 'notification'` chặn cả server, và việc đăng ký 3 app mới (`audit`/`clients`/`jobs`) |
| 2 | [02-serializer-employee.md](02-serializer-employee.md) | `EmployeeLogWorkSerializer` — field-level validation, vì sao check data isolation ngay ở Giai đoạn 1 |
| 3 | [03-view-employee.md](03-view-employee.md) | `EmployeeLogWorkView` — view mỏng (thin view), RBAC qua `HasPermission` |
| 4 | [04-urls-routing.md](04-urls-routing.md) | Quy ước đặt tên theo "3 Quy tắc vàng", wiring vào `worktracker_core/urls.py` |
| 5 | [05-testing-va-ket-qua.md](05-testing-va-ket-qua.md) | Chuẩn bị dữ liệu test qua shell, 4 test case `curl` thật và kết quả |

## Nguyên tắc xuyên suốt cả 5 bước (đáng nhớ nhất để trình bày với team)

1. **Data Isolation không phải "defensive logic thêm sau"** — nó là điều
   kiện đúng/sai cơ bản của tính năng ngay từ bản nháp đầu tiên. Time Lock
   và 24h-cap mới là các lớp phòng thủ bổ sung ở giai đoạn sau.
2. **Serializer lo nghiệp vụ, View chỉ lo luồng HTTP** — đúng pattern đã
   dùng ở `accounts/serializers_auth.py`/`views_auth.py`, áp dụng lại y hệt
   cho app `timesheets`.
3. **"3 Quy tắc vàng để ghép code vô trùng 100%"** áp dụng cho mọi app dùng
   chung, không riêng `accounts` — `timesheets` giờ có `views_employee.py`
   (Tuấn Tú) song song với `views_manager.py` (Đức Long), không đụng file
   của nhau.
4. **Lỗi cấu hình `INSTALLED_APPS` là lỗi "im lặng cho tới khi chạy"** —
   Python không kiểm tra tên module tồn tại lúc gõ code, chỉ báo lỗi lúc
   `django.setup()` chạy thật — cùng lớp lỗi "sai một chữ trong string key"
   đã gặp ở Giai đoạn 1 của `auth-guide`.
