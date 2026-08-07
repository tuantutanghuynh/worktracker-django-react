# Executive Code Annotation: `backend/accounts/views_manager.py`

**Package / Module:** `backend.accounts.views_manager` · Manager IAM Controllers & Data Isolation Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Phân Quyền & Cách Ly Dữ Liệu Trưởng Phòng (Manager Data Isolation Diagram)

```
                       ┌──────────────────────────────────────────┐
                       │    HTTP GET Request (Từ Manager Client)  │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │    ManagerTeamEmployeeListView (APIView) │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │  1. Kiểm tra Quyền: HasPermission        │
                       │     (Mã quyền bắt buộc: employee:view_team)│
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │  2. Kiểm soát Phạm Vi Dữ Liệu (Data Scope│
                       │     Lọc: department__manager = request.user│
                       │     (TUYỆT ĐỐI KHÔNG nhận department_id   │
                       │      từ client gửi lên)                  │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │ Res: Danh Sách Nhân Viên Thuộc Phòng Ban │
                       └──────────────────────────────────────────┘
```

> **Vì sao BẮT BUỘC lọc nhân viên bằng `department__manager=request.user` mà TUYỆT ĐỐI KHÔNG cho phép client truyền `department_id` trên URL/Query params?**
> - **Chống Lỗi Bảo Mật Bị Khai Thác Dữ Liệu Cross-Department (IDOR - Insecure Direct Object Reference):** Nếu API cho phép truyền `department_id` từ client (VD: `/api/manager/team/employees/?department_id=5`), một Trưởng phòng A của Phòng Kỹ Thuật có thể cố tình sửa URL thành `department_id=2` để dòm ngó dữ liệu danh sách nhân viên và mức lương/thông tin cá nhân của Phòng Kế Toán.
> - **Cơ chế Cách ly Dữ liệu Ngầm định (Implicit Data Isolation):** Bằng cách cố định điều kiện lọc `department__manager=request.user` dựa vào đối tượng `request.user` đã qua xác thực Token, hệ thống đảm bảo Trưởng phòng chỉ xem được đúng nhân viên do chính mình quản lý, loại bỏ hoàn toàn nguy cơ bị bypass tham số.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Model Quản Lý Nhân Viên (Imports & Setup)

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
# 3 import này y hệt views_admin.py/views_auth.py -- APIView vì đây là 1 endpoint đơn lẻ (GET danh sách), không
# cần bộ CRUD đầy đủ của ViewSet vì Manager KHÔNG được tạo/sửa/xóa nhân viên qua API này, chỉ ĐƯỢC XEM.

from .permissions import HasPermission
# Cùng class HasPermission dùng ở views_admin.py -- pattern "khai báo required_permission trên class +
# permission_classes = [HasPermission]" (không truyền tham số) sẽ được áp dụng y hệt AdminDisableUserView.

from .models import EmployeeProfile
# Import THẲNG Model EmployeeProfile (không qua get_user_model() như file khác) -- vì file này KHÔNG thao
# tác trên CustomUser, mà trên bảng hồ sơ nhân viên có sẵn quan hệ tới Department.

# This file holds MANAGER-only views for the accounts app. Add future
# Manager-facing endpoints here (e.g. assigning an employee to a
# department), not in views.py.
```

---

### 2. View Truy Vấn Danh Sách Nhân Viên Thuộc Đội Ngũ (Manager Team Employee List View)

```python
# Permission + data isolation example: a MANAGER can only list employees in
# the department they manage, filtered by request.user, never by a client-supplied id.

class ManagerTeamEmployeeListView(APIView):
    required_permission = "employee:view_team"
    permission_classes = [HasPermission]
    # Y hệt pattern ở AdminDisableUserView (file 11): truyền CLASS trần `HasPermission`, không gọi (). DRF tự
    # `HasPermission()` không tham số -> fallback đọc `getattr(view, 'required_permission', None)`.

    def get(self, request):
    # Tên method "get" -> DRF chỉ chấp nhận HTTP GET cho endpoint này (gọi POST/PUT/DELETE vào đây tự 405).

        employees = EmployeeProfile.objects.filter(department__manager=request.user)
        # `department__manager` là DOUBLE-UNDERSCORE LOOKUP đi qua 2 CHẶNG Foreign Key: EmployeeProfile.department
        # (trỏ tới Department) rồi Department.manager (trỏ tới CustomUser) -- Django tự sinh SQL JOIN 2 bảng
        # để so khớp, không cần viết JOIN tay.
        # `department__manager=request.user`: vế phải là 1 INSTANCE Model (request.user), KHÔNG PHẢI 1 số ID
        # -- Django ORM CHO PHÉP so sánh trực tiếp với instance, tự động hiểu là so khớp theo PRIMARY KEY của
        # instance đó (tương đương viết department__manager_id=request.user.id, nhưng an toàn và rõ ý hơn).
        # Đây chính là "chốt chặn" chống IDOR đã nêu ở đầu file: điều kiện lọc lấy từ request.user (đã qua
        # xác thực JWT), TUYỆT ĐỐI không lấy từ tham số client tự gửi lên.

        data = [
            {"id": e.user_id, "full_name": e.full_name, "department": e.department.name}
            for e in employees
        ]
        # LIST COMPREHENSION: cú pháp `[<biểu_thức> for <biến> in <iterable>]` -- tương đương viết vòng for
        # thủ công rồi .append() từng dict vào 1 list rỗng, chỉ gọn hơn. Đây cũng là ĐIỂM QuerySet `employees`
        # THỰC SỰ CHẠY SQL: nó vốn LAZY (chưa query DB) cho tới khi bị DUYỆT QUA bởi vòng `for e in employees`.
        # `e.user_id` đọc trực tiếp cột FK (không cần JOIN thêm) vì Django lưu sẵn `<field>_id` bên cạnh field
        # quan hệ đầy đủ `<field>` -- đọc `_id` không kích hoạt query phụ.
        # `e.department.name` NGƯỢC LẠI: `employees` KHÔNG có `.select_related('department')` -- mỗi lần vòng
        # lặp truy cập `e.department`, Django phải chạy THÊM 1 CÂU SQL RIÊNG để lấy Department tương ứng (vì
        # dữ liệu department chưa được JOIN sẵn từ câu query gốc). Với N nhân viên, đây là VẤN ĐỀ N+1 QUERY
        # y hệt đã học ở UserViewSet (file 11), chỉ khác là ở đó có select_related còn ở đây thì chưa.

        return Response(data, status=status.HTTP_200_OK)
        # `data` truyền vào Response là 1 LIST CÁC DICT thuần Python (không phải qua Serializer nào) -- DRF
        # renderer vẫn tự serialize được thành JSON vì list/dict/str/int/bool đều là kiểu JSON-serializable sẵn.
```

---

## Bảng Tóm Tắt Thiết Kế (Design Summary Table)

| View Class Name | HTTP Method | Target Model | Permission Code Required | Data Isolation Rule | Security Protection |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ManagerTeamEmployeeListView`** | GET | `EmployeeProfile` | `employee:view_team` | `department__manager = request.user` | Chống lỗi IDOR, ép buộc cách ly dữ liệu ngầm định theo Token Manager. |
