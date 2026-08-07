# Giai đoạn 3-4 — Time Lock API + Lớp phòng thủ 1: Tổng quan

Bản ghi lại quá trình triển khai **Giai đoạn 3** (API Time Lock — chốt sổ
kỳ báo cáo) và **Giai đoạn 4** (gắn Time Lock check vào Log Work) trong
roadmap `timesheet-guide/08-roadmap-and-talking-points.md`, nối tiếp
[giai-doan-1-log](../giai-doan-1-log/) và [giai-doan-2-log](../giai-doan-2-log/).

## Phạm vi đã hoàn thành

- **Giai đoạn 3**: `ManagerTimeLockView` — Manager khóa 1 kỳ báo cáo
  (`lock_month`/`lock_year`). Chỉ làm **chiều khóa**, chưa làm Unlock API
  (chưa chốt với team, xem `08-roadmap-and-talking-points.md`).
- **Giai đoạn 4**: `EmployeeLogWorkSerializer.create()` giờ kiểm tra Time
  Lock **trước** khi chạm tới logic 24h-cap (Giai đoạn 2) — đúng thứ tự
  "Lớp phòng thủ 1 trước Lớp phòng thủ 2" đã thiết kế ở
  `timesheet-guide/03-log-work-flow.md`.

## Cây file đã tạo/sửa

```text
backend/timesheets/
├── serializers_manager.py   ← tạo mới: ManagerTimeLockSerializer
├── views_manager.py          ← sửa: thêm ManagerTimeLockView (giữ nguyên
│                                comment header của Đức Long)
├── urls_manager.py           ← sửa: thêm route time-locks/
└── serializers_employee.py   ← sửa: create() thêm check Time Lock đầu hàm
```

## Quyết định trước khi code: việc này có thuộc phạm vi Tuấn Tú không?

Trước khi viết `ManagerTimeLockView`, đặt câu hỏi hợp lý: permission
`timesheet:lock` chỉ seed cho role MANAGER — vậy đây có phải việc của Đức
Long không? Trả lời: **không**, dựa trên 3 căn cứ:

1. `project-roadmap/03-phase-tuan-tu-auth-employee.md` giao rõ: *"API
   TimeLock — **Đức Long sẽ gọi** API này"* (viết, không phải gọi, là việc
   của Tuấn Tú).
2. Quy tắc phân công: *"Người phụ trách bảng = người viết model + migration
   + API CRUD cho bảng đó"* — `time_locks` là bảng của Tuấn Tú.
3. Tiền lệ đã có: `accounts/views_manager.py` đã có sẵn
   `ManagerTeamEmployeeListView` do Tuấn Tú viết từ Giai đoạn 3 (RBAC) —
   cùng pattern "viết API phục vụ vai trò Manager cho bảng mình sở hữu".

**Kết luận**: "views_`<role>`.py" quyết định **ai được phép GỌI** API (vai
trò nào), không quyết định **ai được phép VIẾT** — quyền viết đi theo
quyền sở hữu bảng dữ liệu.

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-manager-timelock-api.md](01-manager-timelock-api.md) | `ManagerTimeLockSerializer`/`View`, bug `UniqueTogetherValidator` tự sinh từ `ModelSerializer` |
| 2 | [02-defensive-layer-1-timelock-check.md](02-defensive-layer-1-timelock-check.md) | Gắn check Time Lock vào `EmployeeLogWorkSerializer.create()`, vì sao dùng `PermissionDenied` (403) không phải `ValidationError` (400) |
| 3 | [03-testing-va-ket-qua.md](03-testing-va-ket-qua.md) | 8 test case thật (4 cho Giai đoạn 3, 4 cho Giai đoạn 4) |

## Nguyên tắc đáng nhớ nhất để trình bày với team

1. **Quyền viết API đi theo quyền sở hữu bảng, không theo vai trò gọi API**
   — 1 người có thể viết code phục vụ nhiều "vai trò" khác nhau, miễn bảng
   dữ liệu là của mình.
2. **`ModelSerializer` tự sinh validator từ constraint của model** —
   `UniqueConstraint` ở `Meta` của model tự động biến thành
   `UniqueTogetherValidator` ẩn, chạy **trước** `validate()` tự viết. Muốn
   tùy chỉnh message, khai báo tường minh trong `Meta.validators`, không tự
   viết lại logic đã có sẵn.
3. **Thứ tự lớp phòng thủ quan trọng vì lý do hiệu năng, không chỉ đúng/sai**
   — check Time Lock (rẻ, chỉ 1 SELECT) đứng trước 24h-cap (đắt hơn, cần
   `select_for_update()` + có thể tạo dòng mới) để dừng sớm, không tốn công
   vô ích khi chắc chắn sẽ bị từ chối.
