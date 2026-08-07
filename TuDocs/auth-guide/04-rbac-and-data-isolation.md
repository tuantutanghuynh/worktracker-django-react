# 04 — RBAC (Role + Permission) và Data Isolation

Đây là phần **quan trọng nhất** trong phạm vi công việc của bạn — tài liệu
yêu cầu gọi khu vực Quản lý Nhân sự & Phân quyền là *"khu vực nhạy cảm nhất,
quyết định ai được làm gì trong hệ thống"*.

## Vì sao chỉ check Role là không đủ

Cách làm "ngây thơ" (naive) mà người mới thường nghĩ tới đầu tiên:

```python
if request.user.role == "ADMIN":
    # cho phép
```

Vấn đề: nếu sau này có 50 endpoint, bạn sẽ rải code kiểm tra `role ==
"ADMIN"` hoặc `role == "MANAGER"` khắp nơi. Khi nghiệp vụ đổi (ví dụ: thêm
role mới "ACCOUNTANT" cũng được xem audit log), bạn phải **lùng sục sửa từng
chỗ** đã hardcode "ADMIN". Đây là lý do tài liệu yêu cầu:

> "Không chỉ dùng Role. Phải dùng: Role + Permission"

## Mô hình 3 bảng — tại sao tách ra như vậy

Nhìn lại 3 bảng đã có sẵn trong `backend/accounts/models.py`:

```text
roles            permissions           role_permissions
─────            ───────────           ─────────────────
id               id                    role_id    (FK → roles)
code (ADMIN)     code (client:create)  permission_id (FK → permissions)
name             name
```

Đây là mô hình **nhiều-nhiều** (Many-to-Many) kinh điển: một Role có nhiều
Permission, một Permission có thể thuộc nhiều Role. Lợi ích thực tế:

- Muốn biết "ADMIN được làm gì" → `role_permissions` filter theo `role_id`.
- Muốn thêm quyền mới cho MANAGER (ví dụ thêm `report:export`) → **chỉ cần
  insert 1 dòng vào `role_permissions`**, không cần sửa code, không cần
  deploy lại.
- Permission code có dạng `resource:action` (ví dụ `client:create`,
  `job:lock`, `task:assign`) — đặt tên theo convention rõ ràng giúp đọc code
  permission check mà không cần đoán.

## Danh sách Permission theo từng Role (từ tài liệu yêu cầu)

### ADMIN
`client:create`, `client:update`, `job:create`, `job:update`, `user:create`,
`user:disable`, `audit:view`

### MANAGER
`task:create`, `task:assign`, `task:review`, `timesheet:lock`, `report:view`

### EMPLOYEE
`task:view_own`, `task:update_own`, `timesheet:create`,
`timesheet:update_own`

Quan sát: permission của EMPLOYEE có hậu tố `_own` (`view_own`,
`update_own`). Đây là gợi ý quan trọng — quyền hạn không chỉ là "được làm
hành động X" mà còn "chỉ trên dữ liệu của chính mình". Đây dẫn tới phần tiếp
theo.

## Data Isolation — vì sao Permission thôi cũng chưa đủ

Permission trả lời "user có được gọi API này không" — nhưng **không trả lời
được "user được thấy DÒNG DỮ LIỆU nào"**. Ví dụ: Manager A và Manager B đều có
permission `task:assign`. Nhưng Manager A chỉ được thấy/giao Task trong dự án
của mình, không phải dự án của Manager B.

Đây gọi là Data Isolation (hoặc Row-level filtering), và nó **không thể** xử
lý ở tầng Permission class chung — phải xử lý ngay tại câu query:

```python
# Manager: chỉ thấy Job mình quản lý
Job.objects.filter(manager=request.user)

# Employee: chỉ thấy Task được giao cho chính mình
Task.objects.filter(assignee=request.user)
```

Nguyên tắc cốt lõi tài liệu nhấn mạnh: **"Không tin tưởng Frontend."** Nghĩa
là dù Frontend ẩn nút/ẩn menu để Manager B "không thấy" dữ liệu của Manager A
trên UI, nếu Backend không tự filter theo `request.user` ở tầng ORM, một
Manager B rành kỹ thuật vẫn có thể tự gọi API trực tiếp (qua Postman, qua
DevTools) và lấy được dữ liệu không thuộc về mình. **UI ẩn không phải là bảo
mật — chỉ là tiện ích.** Bảo mật thật nằm ở câu query trong Django view.

## Cách RBAC + Data Isolation phối hợp trong 1 request (ví dụ cụ thể)

Giả sử API `GET /api/jobs/` — Manager gọi để xem danh sách Job:

```text
[1] Request đến, có Access Token trong header
       ↓
[2] Authentication: SimpleJWT giải mã token → biết request.user là ai
       ↓
[3] Authorization (Permission check): user có permission "job:view"
    (hoặc tương đương) không? Không có → 403, dừng lại.
       ↓ (có quyền)
[4] Data Isolation (query filter): Job.objects.filter(manager=request.user)
    — KHÔNG trả Job.objects.all()
       ↓
[5] Trả về danh sách Job đã được lọc
```

Bước [3] và [4] là 2 lớp khác nhau, dễ nhầm là một: bước [3] hỏi "được làm
hành động này nói chung không", bước [4] hỏi "trong dữ liệu, dòng nào thuộc
phạm vi của tôi". Thiếu bước [4] dù có bước [3] vẫn là lỗ hổng nghiêm trọng.

## Cách triển khai RBAC permission check trong DRF (ý tưởng, chưa phải code thật)

DRF có khái niệm `Permission class` — một class nhỏ trả lời True/False cho
câu hỏi "request này được đi qua không". Ý tưởng (pseudocode, không phải code
cuối):

```python
class HasPermission(BasePermission):
    def has_permission(self, request, view):
        required_code = view.required_permission  # ví dụ "client:create"
        user_role = request.user.role
        return RolePermission.objects.filter(
            role=user_role, permission__code=required_code
        ).exists()
```

Bạn sẽ thiết kế cụ thể hơn (ví dụ cache kết quả này để khỏi query DB mỗi lần,
vì check permission xảy ra ở MỌI request) khi vào giai đoạn code thật — ở đây
chỉ cần nắm ý tưởng: **permission check là 1 lớp filter chạy trước khi vào
logic view, dựa trên bảng `role_permissions`**.

## Câu hỏi tự kiểm tra

1. Một Employee có permission `task:update_own`. Họ gọi API
   `PATCH /api/tasks/55/` để sửa Task không phải của mình (Task của đồng
   nghiệp). Permission check ở bước [3] có chặn được việc này không? Nếu
   không, cần thêm gì ở bước nào?
2. Vì sao không nên hardcode `if user.role == "ADMIN"` ngay cả khi hiện tại
   chỉ có 3 role và có vẻ "ít việc hơn" khi làm theo cách đó?
