# Executive Code Annotation: `backend/tasks/models.py`

**Package / Module:** `backend.tasks.models` · Task Execution & Kanban Domain Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Thực Thể Task & Kanban Subsystem (Tasks Entity Diagram)

```
                            ┌──────────────────────────────────────────┐
                            │          Job (Dự Án / Master Job)        │
                            └────────────────────┬─────────────────────┘
                                                 │ 1
                                                 │
                                                 │ N (on_delete=RESTRICT)
                                                 ▼
                            ┌──────────────────────────────────────────┐
                            │            Task (Bảng Công Việc)         │
                            │ - id (PK)                                │
                            │ - job_id (FK -> Job)                     │
                            │ - assignee_id (FK -> CustomUser)         │
                            │ - creator_id (FK -> CustomUser)          │
                            │ - status & priority (TextChoices, Index) │
                            │ - order_index (Lexicographic String)     │
                            └────┬───────────────────┬────────────────┬┘
                                 │ 1                 │ 1              │ 1
                                 │                   │                │
            ┌────────────────────┘                   │                └────────────────────┐
            │ N (CASCADE)                            │ N (CASCADE)                         │ N (CASCADE)
            ▼                                        ▼                                     ▼
┌───────────────────────┐                ┌───────────────────────┐             ┌───────────────────────┐
│     TaskFollower      │                │      TaskComment      │             │    TaskAttachment     │
│ - unique_task_follower│                │ - comment_type        │             │ - file_name, file_url │
│   (Task + User Constraint)             │   (NORMAL / REJECTION)│             │ - file_size           │
└───────────────────────┘                └───────────────────────┘             └───────────────────────┘
```

> **Vì sao cột `order_index` trong bảng `Task` dùng kiểu `CharField` (VARCHAR) mà không dùng kiểu `IntegerField`?**
> - **Thuật toán Sắp Xếp Từ Điển Kéo-Thả (Lexicographic Ordering Algorithm for Drag-and-Drop - FR-39):** Trên bảng công việc Kanban, khi người dùng kéo thả một Task vào vị trí nằm giữa 2 Task có thứ tự "A" và "B", hệ thống chỉ cần tính toán chuỗi nằm giữa 2 chuỗi đó (ví dụ: chuỗi "AM") và lưu vào DB.
> - Nếu dùng số nguyên (`IntegerField`: 1, 2, 3...), mỗi lần kéo thả một card lên đầu danh sách 1,000 tasks, backend sẽ phải thực thi câu lệnh SQL UPDATE hàng ngàn dòng để tăng `order_index` của tất cả task phía sau lên 1 đơn vị, gây treo và nghẽn hệ thống CSDL. Chuỗi Lexicographic loại bỏ 100% các câu lệnh UPDATE dây chuyền này.

> **Vì sao `TaskComment.comment_type` có hai giá trị `NORMAL` và `REJECTION_NOTE` (FR-41, FR-44)?**
> - **Nghiệm Thu Công Việc & Phân Luồng Báo Cáo:** Khi Nhân viên chuyển Task sang trạng thái `REVIEWING` (Chờ nghiệm thu), nếu Trưởng phòng từ chối (Reject), Trưởng phòng phải nhập lý do từ chối. Comment này được đánh dấu `comment_type = 'REJECTION_NOTE'` để giao diện React tô đỏ nổi bật và hệ thống Báo cáo KPI tính toán tỷ lệ công việc bị từ chối nghiệm thu.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Model Task - Trái Tim Bảng Công Việc Kanban (Task Model)

```python
from django.conf import settings
# "from django.conf import settings" = nạp đối tượng cấu hình Django để lấy `AUTH_USER_MODEL`.

from django.db import models
# "from django.db import models" = nạp thư viện định nghĩa model CSDL của Django.


# ============================================================
# BẢNG 12: tasks
# Công việc chi tiết - trái tim của bảng Kanban.
# Mỗi task thuộc về một job, một assignee và một creator.
#
# Lưu ý:
# - order_index dùng VARCHAR để hỗ trợ thuật toán
#   lexicographic ordering cho drag-and-drop (FR-39).
# - status transition phải tuân theo bảng §8.1 trong spec
#   (kiểm tra ở tầng service/view, không ở model).
# ============================================================
class Task(models.Model):
# "class Task(models.Model):" = định nghĩa bảng `tasks` lưu trữ công việc chi tiết.

    class Priority(models.TextChoices):
    # Enum mức độ ưu tiên công việc.

        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"

    class Status(models.TextChoices):
    # Enum 5 trạng thái quy trình của Task trên Kanban.

        TODO = "TODO", "To Do"
        # Việc cần làm.

        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        # Đang thực hiện.

        REVIEWING = "REVIEWING", "Reviewing"
        # Đang chờ duyệt/nghiệm thu.

        COMPLETED = "COMPLETED", "Completed"
        # Đã hoàn thành.

        CANCELLED = "CANCELLED", "Cancelled"
        # Đã hủy.

    # FK trỏ đến jobs. RESTRICT để chặn xóa dự án khi còn task.
    job = models.ForeignKey(
        "projects.Job",
        on_delete=models.RESTRICT,
        related_name="tasks",
    )
    # "job = models.ForeignKey('projects.Job', ...)" = khóa ngoại liên kết tới Dự án cha (`Job`):
    #   - `on_delete=models.RESTRICT`: Chặn xóa Dự án nếu dự án vẫn còn các công việc con.
    #   - `related_name="tasks"`: Truy vấn các task của dự án qua `job.tasks.all()`.

    # FK trỏ đến user được giao việc. RESTRICT để bảo toàn lịch sử.
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="assigned_tasks",
    )
    # "assignee = ..." = khóa ngoại trỏ tới Nhân viên được giao thực hiện công việc (Assignee).

    # FK trỏ đến user tạo task (thường là Manager). RESTRICT bảo toàn lịch sử.
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="created_tasks",
    )
    # "creator = ..." = khóa ngoại trỏ tới Người khởi tạo công việc (Creator).

    title = models.CharField(max_length=255)
    # "title = ..." = Tiêu đề công việc.

    description = models.TextField(blank=True, null=True)
    # "description = ..." = Mô tả chi tiết nội dung cần làm.

    # INDEX để filter nhanh trên bảng Kanban.
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    # "priority = ..." = Độ ưu tiên task, đánh `db_index=True` để lọc nhanh trên UI Kanban.

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO,
        db_index=True,
    )
    # "status = ..." = Trạng thái công việc trên Kanban, đánh `db_index=True` phục vụ hiển thị cột Kanban.

    # INDEX để truy vấn task quá hạn.
    deadline = models.DateField(db_index=True)
    # "deadline = ..." = Hạn chót hoàn thành task, đánh `db_index=True` để quét thông báo công việc sắp/quá hạn.

    # Thời điểm chuyển sang COMPLETED. Phục vụ tính time-to-completion.
    completed_at = models.DateTimeField(blank=True, null=True)
    # "completed_at = ..." = Ghi nhận thời điểm chính xác task hoàn thành để đo lường tiến độ.

    # Lexicographic string ordering cho Kanban drag-and-drop (FR-39).
    order_index = models.CharField(max_length=255, db_index=True)
    # "order_index = ..." = Thứ tự sắp xếp từ điển (String Indexing) phục vụ thao tác kéo thả thẻ Kanban không bị chậm CSDL.

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tasks"

    def __str__(self):
        return self.title
```

---

### 2. Bảng Người Theo Dõi Công Việc (TaskFollower Model)

```python
# ============================================================
# BẢNG 13: task_followers
# Người theo dõi task - phục vụ routing notification realtime.
# CASCADE cả 2 phía: xóa task hoặc xóa user thì xóa quan hệ follow.
# ============================================================
class TaskFollower(models.Model):
# "class TaskFollower(models.Model):" = bảng lưu danh sách những người theo dõi (Followers) một công việc để nhận thông báo.

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="followers",
    )
    # "task = models.ForeignKey(Task, on_delete=models.CASCADE, ...)" = khóa ngoại tới Task. Xóa Task thì xóa luôn bản ghi follower (`CASCADE`).

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="task_follows",
    )
    # "user = models.ForeignKey(..., on_delete=models.CASCADE, ...)" = khóa ngoại tới User theo dõi.

    joined_at = models.DateTimeField(auto_now_add=True)
    # Thời điểm bắt đầu nhấn nút theo dõi task.

    class Meta:
        db_table = "task_followers"

        # Chống một user follow cùng một task nhiều lần (FR-49).
        constraints = [
            models.UniqueConstraint(
                fields=["task", "user"],
                name="unique_task_follower",
            )
        ]
        # "constraints = [models.UniqueConstraint(...)]" = ràng buộc toàn vẹn CSDL:
        # Một cặp (task, user) chỉ xuất hiện tối đa 1 lần, chặn triệt để lỗi 1 user ấn nút Follow nhiều lần tạo dữ liệu rác.

    def __str__(self):
        return f"{self.user_id} follows task {self.task_id}"
```

---

### 3. Bảng Thảo Luận & Nghiệm Thu Công Việc (TaskComment Model)

```python
# ============================================================
# BẢNG 14: task_comments
# Trung tâm thảo luận và nghiệm thu task.
# ============================================================
class TaskComment(models.Model):
# "class TaskComment(models.Model):" = bảng lưu bình luận, trao đổi và lý do từ chối nghiệm thu công việc.

    class CommentType(models.TextChoices):
        NORMAL = "NORMAL", "Normal Discussion"
        # Thảo luận trao đổi công việc bình thường.

        REJECTION_NOTE = "REJECTION_NOTE", "Rejection Note"
        # Ghi chú lý do từ chối nghiệm thu của Trưởng phòng.

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    # Khóa ngoại trỏ tới Task. Xóa Task thì xóa toàn bộ Comment (`CASCADE`).

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="task_comments",
    )
    # Khóa ngoại trỏ tới User bình luận. Dùng `RESTRICT` để bảo toàn lịch sử ý kiến thảo luận của nhân viên.

    content = models.TextField()
    # Nội dung lời bình luận hoặc lý do từ chối.

    # Phân biệt thảo luận thường và ghi chú từ chối (FR-41, FR-44).
    comment_type = models.CharField(
        max_length=20,
        choices=CommentType.choices,
        default=CommentType.NORMAL,
    )
    # Cột phân loại bình luận.

    # INDEX để load luồng chat theo thứ tự thời gian (§6.7.3).
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # Đánh `db_index=True` để truy vấn luồng chat sắp xếp theo thời gian cực kỳ tối ưu.

    class Meta:
        db_table = "task_comments"

    def __str__(self):
        return f"[{self.comment_type}] on task {self.task_id} by {self.user_id}"
```

---

### 4. Bảng File Đính Kèm Công Việc (TaskAttachment Model)

```python
# ============================================================
# BẢNG 17: task_attachments
# Metadata file đính kèm task.
# File vật lý lưu ở file storage service - DB chỉ lưu URL.
# ============================================================
class TaskAttachment(models.Model):
# "class TaskAttachment(models.Model):" = bảng lưu thông tin tài liệu/tệp tin đính kèm vào công việc.

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    # Khóa ngoại trỏ tới Task (`CASCADE`).

    # User upload. RESTRICT để bảo toàn vết upload.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name="uploaded_attachments",
    )
    # Khóa ngoại trỏ tới Người tải file lên (`RESTRICT`).

    file_name = models.CharField(max_length=255)
    # Tên gốc của file (VD: 'BaoCao_Thang7.pdf').

    file_url = models.CharField(max_length=500)
    # Đường dẫn URL lưu trữ tệp tin trên CDN/Storage Service (S3/MinIO).

    file_size = models.IntegerField(blank=True, null=True)
    # Dung lượng file tính theo dung lượng Bytes.

    uploaded_at = models.DateTimeField(auto_now_add=True)
    # Thời điểm tải file lên.

    class Meta:
        db_table = "task_attachments"

    def __str__(self):
        return self.file_name
```

---

## Bảng Tóm Tắt Thiết Kế (Design Summary Table)

| Model Name | Database Table | Key Attributes & Constraints | Foreign Key Rules | Business Feature Supported |
| :--- | :--- | :--- | :--- | :--- |
| **`Task`** | `tasks` | `order_index` (VARCHAR Lexicographic), `status` & `priority` (Index), `deadline` (Index) | `job` (`RESTRICT`), `assignee` (`RESTRICT`), `creator` (`RESTRICT`) | Trái tim bảng Kanban, hỗ trợ kéo thả siêu tốc và theo dõi deadline. |
| **`TaskFollower`** | `task_followers` | `UniqueConstraint(task, user)` | `task` (`CASCADE`), `user` (`CASCADE`) | Đăng ký nhận thông báo Real-time khi công việc có cập nhật. |
| **`TaskComment`** | `task_comments` | `comment_type` (`NORMAL` vs `REJECTION_NOTE`), `created_at` (Index) | `task` (`CASCADE`), `user` (`RESTRICT`) | Thảo luận công việc & ghi chú lý do từ chối nghiệm thu (FR-41, FR-44). |
| **`TaskAttachment`** | `task_attachments` | `file_name`, `file_url`, `file_size` | `task` (`CASCADE`), `user` (`RESTRICT`) | Quản lý tệp tin tài liệu đính kèm công việc. |
