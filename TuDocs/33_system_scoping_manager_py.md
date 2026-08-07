# Executive Code Annotation: `backend/system/scoping_manager.py`

**Package / Module:** `backend.system.scoping_manager` · Data Scoping & Multi-Tenancy Boundary Rules

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (bức tường rào, kính một chiều, chìa khóa phòng, kho lưu trữ...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Phân Vùng Dữ Liệu Quản Lý (Data Scoping Architecture Diagram)

```
                            ┌───────────────────────────┐
                            │    User Request (Header)  │
                            └─────────────┬─────────────┘
                                          │
                                          ▼
                                   is_admin(user)?
                                   ┌──────┴──────┐
                            Có (Yes)              Không (No)
                               │                  │
                               ▼                  ▼
                    ┌───────────────────┐  is_manager(user)?
                    │ Full Data Access  │  ┌──────┴──────┐
                    │ (Job.objects.all) │ Có             Không
                    └───────────────────┘  │               │
                                           ▼               ▼
                       ┌────────────────────────────────┐ ┌──────────────┐
                       │ Scope Boundary (manager_id=ID) │ │  Empty (None)│
                       └───────────────┬────────────────┘ └──────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
     scoped_jobs()               scoped_tasks()            scoped_logworks()
  (Job: manager_id)          (Task: job__manager_id)   (LogWork: task__job__manager_id)
            │                          │                          │
            ▼                          ▼                          ▼
   scoped_timelocks()       scoped_task_comments()       scoped_team_profiles()
 (LockScope.JOB only)       (Comment: task__job...)      (Employee in manager's tasks)
```

> **Vì sao hàm `get_scoped_object_or_404` lại trả về lỗi `HTTP 404 Not Found` thay vì `HTTP 403 Forbidden` khi dữ liệu nằm ngoài Scope?**
> Đây là kỹ thuật bảo mật chống dò quét thông tin (**Anti-Enumeration Attack**). Nếu trả về `403 Forbidden`, kẻ gian sẽ biết rằng bản ghi (ID) đó *có tồn tại* trong CSDL nhưng họ không có quyền xem. Ngược lại, nếu trả về `404 Not Found`, kẻ gian không thể phân biệt được ID đó có tồn tại hay không, giả lập như bản ghi hoàn toàn không có trên đời, bảo vệ tối đa dữ liệu nhạy cảm của các phòng ban khác.

> **Vì sao `scoped_timelocks` chỉ cho phép Manager thấy các khóa công cấp Dự án (`LockScope.JOB`) mà chặn khóa công Toàn hệ thống (`LockScope.GLOBAL`)?**
> Khóa kỳ chấm công toàn hệ thống (`GLOBAL`) ảnh hưởng đến bảng lương của toàn bộ công ty — đây là thẩm quyền độc quyền của Admin (Phòng Nhân sự / Kế toán). Manager chỉ được phép khóa kỳ chấm công trong phạm vi Dự án (`JOB`) do mình phụ trách để chốt giờ làm việc của nhân sự trước khi gửi báo cáo lên cấp trên.

> **Vì sao `assignment_search_employees_queryset` mở rộng cho Manager tìm kiếm toàn bộ Employee Active trong công ty, nhưng các hàm `scoped_*` khác lại siết chặt?**
> Nghiệp vụ giao việc thực tế đòi hỏi Manager có thể mượn/giao việc cho bất kỳ nhân viên nào trong công ty khi cần phối hợp liên phòng ban. Do đó, hàm search giao việc cho phép tìm thông tin cơ bản (tên, phòng ban). Tuy nhiên, Manager *không có quyền* xem bảng chấm công (LogWork) hay lịch sử hoạt động của nhân viên đó ở các dự án thuộc Manager khác (đảm bảo quyền riêng tư và phân vùng quản lý).

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Các Hằng Số Định Danh Vai Trò

```python
from django.contrib.auth import get_user_model
# "from django.contrib.auth import get_user_model" = hàm lấy động Model User chính thức được khai báo trong settings (`accounts.CustomUser`).

from django.shortcuts import get_object_or_404
# "from django.shortcuts import get_object_or_404" = hàm tiện ích của Django: truy vấn một object từ QuerySet,
# nếu không tìm thấy sẽ tự động ném ra ngoại lệ `Http404` để trả về HTTP status code 404 cho Client.

from accounts.models import EmployeeProfile
# Nạp Model hồ sơ chi tiết nhân viên (chứa department, position, phone...).

from projects.models import Job
# Nạp Model Dự án (Job).

from tasks.models import Task, TaskComment, TaskAttachment
# Nạp các Model liên quan đến Nhiệm vụ: Task, Bình luận (TaskComment), File đính kèm (TaskAttachment).

from timesheets.models import LogWork, TimeLock
# Nạp các Model liên quan đến Chấm công: LogWork (Nhật ký giờ làm), TimeLock (Khóa kỳ chấm công).


ADMIN_ROLE_CODE = "ADMIN"
# Định danh chuỗi vai trò Admin.

MANAGER_ROLE_CODE = "MANAGER"
# Định danh chuỗi vai trò Manager.

EMPLOYEE_ROLE_CODE = "EMPLOYEE"
# Định danh chuỗi vai trò Nhân viên (Employee).
```

---

### 2. Các Hàm Trợ Giúp Kiểm Tra Vai Trò (`is_admin`, `is_manager`, `is_employee`)

```python
def get_user_role_code(user):
    """
    Lấy role code an toàn.
    """
    role = getattr(user, "role", None)
    return getattr(role, "code", None)
    # Lấy thuộc tính `code` từ vai trò người dùng một cách an toàn (tránh crash khi `user` không có `role`).


def is_admin(user):
    return get_user_role_code(user) == ADMIN_ROLE_CODE
    # Kiểm tra xem user có phải Admin không (trả về `True`/`False`).


def is_manager(user):
    return get_user_role_code(user) == MANAGER_ROLE_CODE
    # Kiểm tra xem user có phải Manager không.


def is_employee(user):
    return get_user_role_code(user) == EMPLOYEE_ROLE_CODE
    # Kiểm tra xem user có phải Employee không.
```

---

### 3. Phân Vùng Dự Án (`manager_job_ids` & `scoped_jobs`)

```python
def manager_job_ids(user):
    """
    Danh sách job id thuộc scope của Manager.

    Scope chính thức:
        jobs.manager_id = current_user.id
    """
    if not is_manager(user):
        return Job.objects.none().values_list("id", flat=True)
    # Nếu không phải Manager -> trả về một QuerySet rỗng (`Job.objects.none()`).

    return Job.objects.filter(
        manager_id=user.id
    ).values_list("id", flat=True)
    # Rút ra danh sách phẳng chứa ID của tất cả các Job mà user này đứng tên Quản lý (`manager_id = user.id`).


def scoped_jobs(user):
    """
    Job queryset đã được scope.

    Admin: thấy tất cả.
    Manager: chỉ thấy Job do mình quản lý.
    Khác: không thấy gì.
    """
    if is_admin(user):
        return Job.objects.all()
    # Admin có quyền năng tối cao -> Trả về toàn bộ Dự án trong hệ thống.

    if is_manager(user):
        return Job.objects.filter(manager_id=user.id)
    # Manager chỉ được nhìn thấy các Dự án do chính mình làm chủ quản lý.

    return Job.objects.none()
    # Đối tượng khác (VD: Employee truy cập endpoint này) -> Không thấy gì cả.
```

---

### 4. Phân Vùng Nhiệm Vụ, Bình Luận & File Đính Kèm (`scoped_tasks`, `scoped_task_comments`, `scoped_task_attachments`)

```python
def scoped_tasks(user):
    """
    Task queryset đã được scope.

    Manager thấy task thuộc job do Manager đó quản lý.
    """
    if is_admin(user):
        return Task.objects.all()
    # Admin thấy toàn bộ Task.

    if is_manager(user):
        return Task.objects.filter(job__manager_id=user.id)
    # "job__manager_id=user.id" = Đột phá mối quan hệ 2 cấp qua dấu gạch dưới đôi `__`:
    # Lọc Task nằm trong Job mà Job đó có `manager_id` bằng ID của user hiện tại.

    return Task.objects.none()


def scoped_task_comments(user):
    """
    Comment queryset đã được scope theo task -> job -> manager.
    """
    if is_admin(user):
        return TaskComment.objects.all()

    if is_manager(user):
        return TaskComment.objects.filter(
            task__job__manager_id=user.id
        )
        # Truy vấn xuyên 3 cấp: TaskComment -> Task (`task`) -> Job (`job`) -> `manager_id`.

    return TaskComment.objects.none()


def scoped_task_attachments(user):
    """
    Attachment queryset đã được scope theo task -> job -> manager.
    """
    if is_admin(user):
        return TaskAttachment.objects.all()

    if is_manager(user):
        return TaskAttachment.objects.filter(
            task__job__manager_id=user.id
        )
        # Lọc các file đính kèm của Task thuộc Job do Manager làm chủ.

    return TaskAttachment.objects.none()
```

---

### 5. Phân Vùng Nhật Ký Chấm Công & Khóa Kỳ Công (`scoped_logworks` & `scoped_timelocks`)

```python
def scoped_logworks(user):
    """
    LogWork queryset đã được scope theo log_work -> task -> job -> manager.
    """
    if is_admin(user):
        return LogWork.objects.all()

    if is_manager(user):
        return LogWork.objects.filter(
            task__job__manager_id=user.id
        )
        # Lọc nhật ký giờ làm (LogWork) của nhân viên đính kèm trong các Task thuộc Job do Manager làm chủ.

    return LogWork.objects.none()


def scoped_timelocks(user):
    """
    TimeLock queryset đã được scope.

    Manager chỉ xử lý JOB lock thuộc Job do mình quản lý.
    GLOBAL lock thuộc Admin, không thuộc nhóm Manager.
    """
    if is_admin(user):
        return TimeLock.objects.all()

    if is_manager(user):
        return TimeLock.objects.filter(
            lock_scope=TimeLock.LockScope.JOB,
            job__manager_id=user.id,
        )
        # Manager chỉ thấy lệnh khóa công có scope là `JOB` và thuộc Job của mình. Chặn không cho thấy khóa `GLOBAL`.

    return TimeLock.objects.none()
```

---

### 6. Phân Vùng Danh Sách Đội Ngũ Nhân Sự (`scoped_team_user_ids` & `scoped_team_profiles`)

```python
def scoped_team_user_ids(user):
    """
    Danh sách user id của Employee đang được giao ít nhất 1 task
    trong các job thuộc Manager.

    Dùng cho Team Directory trong scope.
    """
    if not is_manager(user):
        return Task.objects.none().values_list("assignee_id", flat=True)

    return (
        Task.objects.filter(job__manager_id=user.id)
        .values_list("assignee_id", flat=True)
        .distinct()
    )
    # Lấy danh sách duy nhất (`.distinct()`) các ID nhân viên được giao Task (`assignee_id`) trong các Job của Manager.


def scoped_team_profiles(user):
    """
    Profile Employee thuộc Team Directory của Manager.

    Chỉ gồm Employee đã từng/có task trong job thuộc Manager.
    """
    if is_admin(user):
        return EmployeeProfile.objects.select_related(
            "user",
            "department",
        ).all()
        # Admin thấy toàn bộ Profile nhân viên, dùng `select_related` nạp trước `user` và `department` để tránh N+1 Query.

    if is_manager(user):
        return EmployeeProfile.objects.filter(
            user_id__in=scoped_team_user_ids(user)
        ).select_related(
            "user",
            "department",
        )
        # Manager chỉ nhìn thấy Profile của các nhân viên nằm trong danh sách team `scoped_team_user_ids`.

    return EmployeeProfile.objects.none()
```

---

### 7. Truy Vấn Tìm Nhân Viên Giao Việc & Các Hàm Kiểm Tra Chặt Chẽ (`assignment_search_employees_queryset`, `get_scoped_object_or_404`, `assert_job_in_manager_scope`)

```python
def assignment_search_employees_queryset():
    """
    Queryset dùng riêng cho màn hình tìm Employee để giao task.

    Theo tài liệu gốc:
    - Manager được search basic profile của active Employee để giao việc.
    - Quyền này không đồng nghĩa với quyền xem timesheet/report/performance
      của Employee ngoài scope.
    """
    User = get_user_model()

    return User.objects.filter(
        is_active=True,
        role__code=EMPLOYEE_ROLE_CODE,
    ).select_related(
        "role",
        "profile",
        "profile__department",
    )
    # Trả về danh sách tất cả Nhân viên (EMPLOYEE) đang hoạt động (`is_active=True`) phục vụ ô tìm kiếm giao việc.


def get_scoped_object_or_404(scoped_queryset, **lookup):
    """
    Lấy object bên trong queryset đã scope.

    Nếu record không tồn tại hoặc nằm ngoài scope:
        trả 404.

    Cách này tránh lộ thông tin rằng record ngoài scope có tồn tại.
    """
    return get_object_or_404(scoped_queryset, **lookup)
    # Thực thi `get_object_or_404` trên QuerySet đã được phân vùng an toàn.


def assert_job_in_manager_scope(user, job):
    """
    Dùng trong service khi đã có object Job.

    Nếu job không thuộc Manager hiện tại thì raise PermissionError.
    """
    if not is_manager(user):
        raise PermissionError("USER_IS_NOT_MANAGER")
        # Ném lỗi nếu user không có vai trò Manager.

    if job.manager_id != user.id:
        raise PermissionError("JOB_OUT_OF_MANAGER_SCOPE")
        # Ném lỗi nếu Job này không do Manager này quản lý.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Hàm Phân Vùng Dữ Liệu | Đối Tượng Áp Dụng | Logic Phân Phối Dữ Liệu (Filtering Rules) | Mục Đích Nghiệp Vụ WorkTracker |
|-----------------------|-------------------|-------------------------------------------|--------------------------------|
| `scoped_jobs()` | `Job` Model | Admin: All <br> Manager: `manager_id = user.id` | Quản lý dự án đúng phân vùng quản lý |
| `scoped_tasks()` | `Task` Model | Admin: All <br> Manager: `job__manager_id = user.id` | Chỉ cho phép Manager thao tác trên công việc thuộc dự án của mình |
| `scoped_logworks()` | `LogWork` Model | Admin: All <br> Manager: `task__job__manager_id = user.id` | Quản lý và duyệt giờ làm việc của nhân sự thuộc dự án |
| `scoped_timelocks()` | `TimeLock` Model | Admin: All <br> Manager: `lock_scope = JOB` & `job__manager_id = user.id` | Manager chỉ được khóa sổ chấm công cấp Dự án, không can thiệp khóa sổ toàn công ty (`GLOBAL`) |
| `scoped_team_profiles()`| `EmployeeProfile` | Admin: All <br> Manager: Nhân viên có task trong Job của Manager | Giới hạn danh bạ nhân sự hiển thị đúng đội ngũ đang cộng tác |
| `assignment_search_...()`| `CustomUser` | Filter `is_active=True` & `role__code=EMPLOYEE` | Mở rộng danh sách tìm kiếm nhân sự để phân công giao nhiệm vụ liên phòng ban |
| `get_scoped_object_or_404()`| General Helper | Thực thi lookup trên `scoped_queryset` | Bảo mật chống dò quét dữ liệu (Anti-Enumeration) bằng lỗi 404 |
| `assert_job_in_manager_scope()`| Service Assertion | Raise `PermissionError` nếu `job.manager_id != user.id` | Thắt chặt an toàn ở lớp Business Logic / Service Layer |
