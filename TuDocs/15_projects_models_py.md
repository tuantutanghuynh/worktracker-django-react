# Executive Code Annotation: `backend/projects/models.py`

**Package / Module:** `backend.projects.models` · Projects & Clients Data Domain Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Thực Thể Quan Hệ Bảng Dự Án & Khách Hàng (Projects Entity Relationship Diagram)

```
        ┌──────────────────────────────────────────────────────────┐
        │                     Client (Khách Hàng)                  │
        │ - id (PK)                                                │
        │ - tax_code (UNIQUE, INDEX)                               │
        │ - is_active (BooleanField, INDEX, Soft Delete)           │
        └────────────────────────────┬─────────────────────────────┘
                                     │ 1
                                     │
                                     │ N (on_delete=RESTRICT)
                                     ▼
        ┌──────────────────────────────────────────────────────────┐
        │                     Job (Dự Án / Master Job)             │
        │ - id (PK)                                                │
        │ - client_id (FK -> Client)                               │
        │ - manager_id (FK -> CustomUser)  <── DUY NHẤT cho scope  │
        │ - deadline (DateField, INDEX)                            │
        │ - priority & status (TextChoices, INDEX)                 │
        └──────────────────────────────────────────────────────────┘
```

> **Vì sao `Job.manager` là thuộc tính DUY NHẤT dùng để xác định phạm vi quyền của Manager (Manager Access Scope) trên toàn hệ thống?**
> - **Quy tắc thiết kế nghiệp vụ chuẩn (FR-31, FR-99, FR-117):** Trưởng phòng (Manager) có thể quản lý một Phòng ban (Department), nhưng trong thực tế các Dự án (`Job`) có thể giao cho Trưởng phòng phụ trách cross-department hoặc liên quan tới khách hàng bên ngoài.
> - Phạm vi dữ liệu công việc (Tasks, Timesheets, Reports) mà Manager được quyền xem/sửa **LUÔN LUÔN** dựa vào `Job.manager_id == request.user.id`, tuyệt đối không dùng `Department.manager_id` để tránh việc Manager xem nhầm dự án của phòng khác hoặc bỏ sót dự án mình được giao phụ trách.

> **Vì sao khóa ngoại `client` và `manager` trong model `Job` đều dùng `on_delete=models.RESTRICT` thay vì `CASCADE` hay `SET_NULL`?**
> - **Bảo toàn Dữ liệu Lịch sử & Kiểm toán (Data Integrity Auditability):** Nếu xóa một Khách hàng hay một Tài khoản Manager mà dùng `CASCADE`, toàn bộ các Dự án, Công việc, và Chấm công (Timesheets) liên quan sẽ bị xóa sạch khỏi database. Nếu dùng `SET_NULL`, dự án sẽ bị "mồ côi" không biết ai quản lý hay thuộc khách hàng nào. `RESTRICT` ngăn chặn tuyệt đối việc xóa đối tượng cha khi đang còn dữ liệu con phụ thuộc.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Khởi Tạo Bảng Khách Hàng (Client Model)

```python
from django.conf import settings
# "from django.conf import settings" = nạp đối tượng cấu hình trung tâm của Django.
# Dùng để truy xuất `settings.AUTH_USER_MODEL` làm tham số cho Khóa ngoại trỏ tới User Model tùy chỉnh (`CustomUser`).

from django.db import models
# "from django.db import models" = nạp module `models` nền tảng của Django ORM để định nghĩa cấu trúc bảng CSDL.


# ============================================================
# BẢNG 8: clients
# Danh mục Khách hàng / Đối tác gốc
# Là root business entity cho jobs.
# Áp dụng soft delete (is_active) thay vì xóa vật lý
# để bảo toàn dữ liệu lịch sử của các job đã liên kết.
# ============================================================
class Client(models.Model):
# "class Client(models.Model):" = định nghĩa model `Client` đại diện cho bảng `clients` lưu danh mục Khách hàng/Đối tác.

    client_name = models.CharField(max_length=255)
    # "client_name = models.CharField(max_length=255)" = tên công ty/khách hàng, lưu dạng chuỗi văn bản ngắn tối đa 255 ký tự.

    # UNIQUE + INDEX phục vụ tìm kiếm và đảm bảo không trùng mã số thuế
    tax_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )
    # "tax_code = models.CharField(...)" = Mã số thuế của khách hàng:
    #   - `unique=True`: Đảm bảo trong CSDL không có 2 khách hàng nào bị trùng mã số thuế.
    #   - `db_index=True`: Tạo chỉ mục Database Index giúp tốc độ truy vấn tìm kiếm theo MST đạt tốc độ tức thì.

    contact_person = models.CharField(
        max_length=150,
        blank=True,
        null=True,
    )
    # "contact_person = ..." = tên người đại diện liên hệ phía khách hàng. `blank=True, null=True` cho phép để trống.

    contact_email = models.EmailField(
        max_length=155,
        blank=True,
        null=True,
    )
    # "contact_email = ..." = địa chỉ email người liên hệ. Tự động kiểm tra định dạng email hợp lệ.

    contact_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )
    # "contact_phone = ..." = số điện thoại người liên hệ.

    # Cờ Soft Delete. Chuyển về False thay vì xóa vật lý.
    # INDEX để filter active/inactive nhanh.
    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )
    # "is_active = models.BooleanField(...)" = cờ trạng thái hoạt động:
    #   - `default=True`: Mặc định khách hàng mới tạo sẽ ở trạng thái đang hoạt động.
    #   - `db_index=True`: Đánh Index để các câu lệnh SQL filter `WHERE is_active = True` chạy cực nhanh.
    #   - Áp dụng kỹ thuật Xóa Mềm (Soft Delete): Khi ngưng hợp tác, chỉ chuyển về `False` chứ không DELETE dòng trong DB.

    class Meta:
    # "class Meta:" = lớp cấu hình cho Model Client.

        db_table = "clients"
        # "db_table = 'clients'" = đặt tên bảng trực tiếp trong PostgreSQL là `clients`.

    def __str__(self):
    # "def __str__(self):" = định nghĩa đại diện chuỗi của đối tượng khi in ra màn hình hoặc trang Django Admin.

        return self.client_name
        # Trả về tên khách hàng.
```

---

### 2. Định Nghĩa Bảng Dự Án (Job Model)

```python
# ============================================================
# BẢNG 9: jobs
# Danh mục Dự án / Gói công việc lớn (master job).
#
# Lưu ý quan trọng:
# jobs.manager_id là field DUY NHẤT được dùng để tính
# Manager access scope trên toàn hệ thống (jobs, tasks,
# timesheets, reports). Không dùng departments.manager_id
# cho mục đích này (xem FR-31, FR-99, FR-117).
# ============================================================
class Job(models.Model):
# "class Job(models.Model):" = định nghĩa model `Job` đại diện cho Dự án/Gói công việc lớn.

    class Priority(models.TextChoices):
    # "class Priority(models.TextChoices):" = định nghĩa bảng ENUM danh mục độ ưu tiên của dự án.

        HIGH   = 'HIGH',   'High'
        # Mức ưu tiên Cao ('HIGH').

        MEDIUM = 'MEDIUM', 'Medium'
        # Mức ưu tiên Trung bình ('MEDIUM').

        LOW    = 'LOW',    'Low'
        # Mức ưu tiên Thấp ('LOW').

    # ENUM trạng thái dự án (FR-29: Job Status Management)
    class Status(models.TextChoices):
    # "class Status(models.TextChoices):" = định nghĩa ENUM vòng đời trạng thái của dự án.

        PLANNING = "PLANNING", "Planning"
        # Dự án đang trong giai đoạn lập kế hoạch.

        ACTIVE = "ACTIVE", "Active"
        # Dự án đang chạy/đang thực hiện.

        COMPLETED = "COMPLETED", "Completed"
        # Dự án đã hoàn thành.

        ON_HOLD = "ON_HOLD", "On Hold"
        # Dự án tạm dừng.

        CANCELLED = "CANCELLED", "Cancelled"
        # Dự án bị hủy bỏ.

    # Khóa ngoại trỏ đến Khách hàng.
    # RESTRICT để chặn xóa khách hàng nếu đang có dự án liên kết.
    client = models.ForeignKey(
        Client,
        on_delete=models.RESTRICT,
        related_name="jobs",
    )
    # "client = models.ForeignKey(Client, ...)" = khóa ngoại liên kết Dự án tới Khách hàng:
    #   - `on_delete=models.RESTRICT`: Chặn không cho xóa Khách hàng nếu khách hàng đó đang có dự án tồn tại.
    #   - `related_name="jobs"`: Cho phép từ đối tượng `client` truy vấn ngược danh sách dự án qua `client.jobs.all()`.

    # Khóa ngoại trỏ đến User (Manager phụ trách).
    # Dùng settings.AUTH_USER_MODEL thay vì import CustomUser trực tiếp
    # để tránh circular import giữa các app.
    # RESTRICT để bảo vệ lịch sử công việc.
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="managed_jobs",
    )
    # "manager = models.ForeignKey(settings.AUTH_USER_MODEL, ...)" = khóa ngoại trỏ tới Quản lý dự án (Manager):
    #   - `settings.AUTH_USER_MODEL`: Tham chiếu linh hoạt tới User model, tránh lỗi import vòng quanh (Circular Import).
    #   - `related_name="managed_jobs"`: Truy vấn các dự án do user quản lý qua `user.managed_jobs.all()`.

    job_code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    # "job_code = ..." = Mã quản lý dự án (VD: 'PRJ-2026-001'), là duy nhất (`unique=True`).

    job_name = models.CharField(max_length=255)
    # "job_name = ..." = Tên chi tiết của dự án.

    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    # "priority = ..." = Độ ưu tiên dự án. Đánh `db_index=True` để sắp xếp/lọc báo cáo ưu tiên nhanh chóng.

    description = models.TextField(
        blank=True,
        null=True,
    )
    # "description = ..." = Mô tả chi tiết phạm vi dự án (lưu dạng văn bản dài `TextField`).

    start_date = models.DateField()
    # "start_date = ..." = Ngày bắt đầu triển khai dự án.

    # INDEX để tối ưu tốc độ quét dự án trễ hạn (overdue job lookup).
    deadline = models.DateField(db_index=True)
    # "deadline = ..." = Hạn chót hoàn thành dự án. Đánh `db_index=True` để Celery Job quét dự án trễ hạn cực nhanh.

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNING,
    )
    # "status = ..." = Trạng thái hiện tại của dự án (mặc định là `PLANNING`).

    created_at = models.DateTimeField(auto_now_add=True)
    # "created_at = ..." = Thời điểm khởi tạo bản ghi dự án trên hệ thống.

    updated_at = models.DateTimeField(auto_now=True)
    # "updated_at = ..." = Tự động cập nhật thời điểm mỗi khi sửa thông tin dự án.

    class Meta:
    # "class Meta:" = cấu hình bảng cho Job.

        db_table = "jobs"
        # Đặt tên bảng CSDL là `jobs`.

    def __str__(self):
        return self.job_name
        # Trả về tên dự án khi hiển thị dạng chuỗi.
```

---

## Bảng Tóm Tắt Thiết Kế (Design Summary Table)

| Model Name | Database Table | Key Attributes & Constraints | Foreign Keys & Deletion Rules | Role in Business Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`Client`** | `clients` | `tax_code` (Unique + Index), `is_active` (Soft Delete Index) | Không có | Thực thể gốc lưu trữ Khách hàng/Đối tác hợp đồng. |
| **`Job`** | `jobs` | `job_code` (Unique), `deadline` (Index), `priority` & `status` (TextChoices) | `client_id` -> `Client` (`RESTRICT`), `manager_id` -> `CustomUser` (`RESTRICT`) | Root Master Job. `manager_id` quyết định 100% Manager Access Scope. |
