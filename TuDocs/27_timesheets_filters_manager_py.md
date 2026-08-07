# Executive Code Annotation: `backend/timesheets/filters_manager.py`

**Package / Module:** `backend.timesheets.filters_manager` · Query Filtering Layer (Manager Scope)

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (bộ lọc kính mát, phễu lọc cà phê, danh sách kiểm tra an ninh...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Bộ Lọc (Filter Flow Diagram)

```
                            ┌────────────────────────────────────────┐
                            │    HTTP Query Parameters (URL params)  │
                            │ e.g. ?review_status=SUBMITTED&job_id=5 │
                            └───────────────────┬────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ManagerLogWorkFilter / ManagerTimeLockFilter                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. parse_int_param() / parse_bool_param() (Kiểm tra kiểu dữ liệu an toàn)               │
│ 2. filter_review_status() (Lọc theo trạng thái phê duyệt)                               │
│ 3. filter_job() / filter_task() / filter_user() (Lọc theo Dự án/Công việc/Nhân viên)  │
│ 4. filter_work_date_range() (Lọc khoảng thời gian từ ngày -> đến ngày)                 │
│ 5. filter_search() (Tìm kiếm từ khóa bằng Q() object)                                  │
│ 6. apply_ordering() (Sắp xếp theo danh sách trường cho phép VALID_ORDER_FIELDS)        │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │
                                        ▼
                            ┌────────────────────────────────────────┐
                            │   Filtered QuerySet (Trả về kết quả)   │
                            └────────────────────────────────────────┘
```

> **Vì sao phải viết class Filter riêng thay vì dùng thẳng `django-filter`?**
> Cần kiểm soát chặt chẽ việc ép kiểu (Validation) và chống SQL Injection / Invalid Parameters trên giao diện Manager. Class Filter tùy biến giúp trả về thông báo lỗi chuẩn xác (VD: `job_id must be an integer`) và kiểm tra whitelist các trường sắp xếp (`VALID_ORDER_FIELDS`), tránh lỗi hệ thống khi người dùng gõ linh tinh trên URL.

> **Vì sao Filter nhận vào QuerySet đã qua `scoped_logworks(request.user)`?**
> Đây là nguyên lý **Defense in Depth** (Phòng thủ nhiều lớp). Bộ lọc chỉ thực hiện lọc dữ liệu trên danh sách các bản ghi mà Manager ĐÃ CÓ QUYỀN XEM (đã qua lớp Scoping), tuyệt đối không để bộ lọc tự ý `LogWork.objects.all()` làm rò rỉ dữ liệu của các Manager/Phòng ban khác.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Các Hàm Helper Ep Kiểu Tham Số (Parameter Parsing Utilities)

```python
from django.db.models import Q
# "from django.db.models import Q" = mượn đối tượng `Q` của Django.
# `Q` cho phép tạo các câu lệnh truy vấn phức tạp kết hợp điều kiện HOẶC (OR `|`) hay VÀ (AND `&`).

from django.utils.dateparse import parse_date
# "parse_date" = hàm tiện ích chuyển đổi chuỗi ngày dạng "YYYY-MM-DD" thành đối tượng Python `date`.

from rest_framework.exceptions import ValidationError
# "ValidationError" = ném lỗi khi dữ liệu người dùng truyền lên URL tham số sai định dạng.

from timesheets.models import LogWork, TimeLock
# Import 2 model chính của app timesheets để lấy danh sách lựa chọn enum (`choices`).


def parse_int_param(value, field_name):
# Hàm chuyển đổi tham số từ chuỗi URL sang số nguyên `int` an toàn.
    if value is None or value == "":
        return None
        # Nếu không truyền tham số hoặc tham số rỗng -> trả về None (không lọc theo trường này).

    if not str(value).isdigit():
        raise ValidationError(
            {
                field_name: f"{field_name} must be an integer."
            }
        )
        # "isdigit()" = kiểm tra xem chuỗi có phải toàn bộ là chữ số hay không.
        # Nếu có chứa chữ cái hoặc ký tự đặc biệt -> ném lỗi ValidationError 400.

    return int(value)
    # Ép kiểu từ chuỗi sang số nguyên và trả về.


def parse_bool_param(value, field_name):
# Hàm chuyển đổi tham số từ chuỗi URL sang kiểu `bool` (`True`/`False`).
    if value is None:
        return None

    clean_value = str(value).strip().lower()
    # Chuyển chuỗi về chữ thường và xóa khoảng trắng thừa 2 đầu.

    if clean_value in ["true", "1"]:
        return True
        # Nếu là "true" hoặc "1" -> trả về True.

    if clean_value in ["false", "0"]:
        return False
        # Nếu là "false" hoặc "0" -> trả về False.

    raise ValidationError(
        {
            field_name: "Use true/false or 1/0."
        }
    )
```

---

### 2. Bộ Lọc LogWork Dành Cho Manager (`ManagerLogWorkFilter`)

```python
class ManagerLogWorkFilter:
    """
    Filter LogWork cho Manager.
    Lưu ý: Queryset truyền vào phải là scoped_logworks(request.user).
    """

    VALID_ORDER_FIELDS = {
        "work_date",
        "hours_spent",
        "created_at",
        "updated_at",
        "review_status",
    }
    # Whitelist tập hợp các trường hợp lệ được phép dùng để sắp xếp danh sách chấm công.

    @classmethod
    def apply(cls, queryset, params):
    # "@classmethod" = phương thức lớp, gọi trực tiếp qua `ManagerLogWorkFilter.apply(qs, params)`.
        queryset = cls.filter_review_status(queryset, params)
        queryset = cls.filter_job(queryset, params)
        queryset = cls.filter_task(queryset, params)
        queryset = cls.filter_user(queryset, params)
        queryset = cls.filter_work_date_range(queryset, params)
        queryset = cls.filter_search(queryset, params)
        queryset = cls.apply_ordering(queryset, params)

        return queryset
        # Áp dụng lần lượt từng phễu lọc và trả về QuerySet cuối cùng.

    @classmethod
    def filter_review_status(cls, queryset, params):
        review_status = params.get("review_status") or params.get("status")
        review_status_in = params.get("review_status__in") or params.get("status__in")

        valid_statuses = {
            value
            for value, label in LogWork.ReviewStatus.choices
        }
        # Tạo tập hợp các giá trị trạng thái hợp lệ từ Model choices (DRAFT, SUBMITTED, APPROVED...).

        if review_status:
            if review_status not in valid_statuses:
                raise ValidationError({"review_status": "Invalid review status."})
            queryset = queryset.filter(review_status=review_status)

        if review_status_in:
            status_list = [
                item.strip()
                for item in review_status_in.split(",")
                if item.strip()
            ]
            # Cho phép lọc nhiều trạng thái phân cách bằng dấu phẩy (VD: ?status__in=SUBMITTED,REJECTED).

            invalid_statuses = [
                item
                for item in status_list
                if item not in valid_statuses
            ]

            if invalid_statuses:
                raise ValidationError({"review_status__in": f"Invalid statuses: {invalid_statuses}"})

            queryset = queryset.filter(review_status__in=status_list)

        return queryset

    @classmethod
    def filter_job(cls, queryset, params):
        job_id = parse_int_param(params.get("job_id"), "job_id")
        if job_id is None:
            return queryset
        return queryset.filter(task__job_id=job_id)
        # "task__job_id" = lọc qua 2 cấp quan hệ Foreign Key (LogWork -> Task -> Job).

    @classmethod
    def filter_task(cls, queryset, params):
        task_id = parse_int_param(params.get("task_id"), "task_id")
        if task_id is None:
            return queryset
        return queryset.filter(task_id=task_id)

    @classmethod
    def filter_user(cls, queryset, params):
        user_id = parse_int_param(params.get("user_id"), "user_id")
        if user_id is None:
            return queryset
        return queryset.filter(user_id=user_id)

    @classmethod
    def filter_work_date_range(cls, queryset, params):
        work_date_from = params.get("work_date_from")
        work_date_to = params.get("work_date_to")

        if work_date_from:
            parsed_from = parse_date(work_date_from)
            if parsed_from is None:
                raise ValidationError({"work_date_from": "Invalid date format. Use YYYY-MM-DD."})
            queryset = queryset.filter(work_date__gte=parsed_from)
            # "__gte" = Greater Than or Equal (Ngày chấm công >= work_date_from).

        if work_date_to:
            parsed_to = parse_date(work_date_to)
            if parsed_to is None:
                raise ValidationError({"work_date_to": "Invalid date format. Use YYYY-MM-DD."})
            queryset = queryset.filter(work_date__lte=parsed_to)
            # "__lte" = Less Than or Equal (Ngày chấm công <= work_date_to).

        return queryset

    @classmethod
    def filter_search(cls, queryset, params):
        search = params.get("search")
        if not search or not search.strip():
            return queryset

        search = search.strip()
        return queryset.filter(
            Q(description__icontains=search)
            | Q(task__title__icontains=search)
            | Q(user__email__icontains=search)
            | Q(user__profile__full_name__icontains=search)
        )
        # Dùng toán tử `|` (OR) trong `Q()` để tìm kiếm từ khóa không phân biệt hoa thường (`icontains`)
        # đồng thời trên 4 trường: Mô tả công việc, Tên task, Email user, Họ tên nhân viên.

    @classmethod
    def apply_ordering(cls, queryset, params):
        ordering = params.get("ordering")
        if not ordering:
            return queryset.order_by("-work_date", "-created_at")
            # Mặc định sắp xếp giảm dần theo ngày làm và ngày tạo log.

        raw_field = ordering.strip()
        field_name = raw_field.lstrip("-")
        # "lstrip('-')" = loại bỏ dấu `-` ở đầu chuỗi (nếu có) để lấy tên trường gốc kiểm tra whitelist.

        if field_name not in cls.VALID_ORDER_FIELDS:
            raise ValidationError({"ordering": f"Invalid ordering field: {field_name}"})

        return queryset.order_by(raw_field)
```

---

### 3. Bộ Lọc Kỳ Khóa Sổ TimeLock (`ManagerTimeLockFilter`)

```python
class ManagerTimeLockFilter:
    """
    Filter TimeLock cho Manager.
    """

    VALID_ORDER_FIELDS = {
        "lock_month",
        "lock_year",
        "locked_at",
        "unlocked_at",
        "updated_at",
        "is_locked",
    }

    @classmethod
    def apply(cls, queryset, params):
        queryset = cls.filter_job(queryset, params)
        queryset = cls.filter_month_year(queryset, params)
        queryset = cls.filter_is_locked(queryset, params)
        queryset = cls.filter_lock_scope(queryset, params)
        queryset = cls.apply_ordering(queryset, params)

        return queryset

    @classmethod
    def filter_job(cls, queryset, params):
        job_id = parse_int_param(params.get("job_id"), "job_id")
        if job_id is None:
            return queryset
        return queryset.filter(job_id=job_id)

    @classmethod
    def filter_month_year(cls, queryset, params):
        lock_month = parse_int_param(params.get("lock_month"), "lock_month")
        lock_year = parse_int_param(params.get("lock_year"), "lock_year")

        if lock_month is not None:
            if not 1 <= lock_month <= 12:
                raise ValidationError({"lock_month": "lock_month must be between 1 and 12."})
            queryset = queryset.filter(lock_month=lock_month)

        if lock_year is not None:
            queryset = queryset.filter(lock_year=lock_year)

        return queryset

    @classmethod
    def filter_is_locked(cls, queryset, params):
        is_locked = parse_bool_param(params.get("is_locked"), "is_locked")
        if is_locked is None:
            return queryset
        return queryset.filter(is_locked=is_locked)

    @classmethod
    def filter_lock_scope(cls, queryset, params):
        lock_scope = params.get("lock_scope")
        if not lock_scope:
            return queryset

        valid_scopes = {value for value, label in TimeLock.LockScope.choices}
        if lock_scope not in valid_scopes:
            raise ValidationError({"lock_scope": "Invalid lock scope."})

        return queryset.filter(lock_scope=lock_scope)

    @classmethod
    def apply_ordering(cls, queryset, params):
        ordering = params.get("ordering")
        if not ordering:
            return queryset.order_by("-lock_year", "-lock_month", "job_id")

        raw_field = ordering.strip()
        field_name = raw_field.lstrip("-")

        if field_name not in cls.VALID_ORDER_FIELDS:
            raise ValidationError({"ordering": f"Invalid ordering field: {field_name}"})

        return queryset.order_by(raw_field)
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Thành phần Lọc | Cơ chế Xử lý | Ý nghĩa Nghiệp vụ & An toàn |
|---------------|--------------|-----------------------------|
| **`parse_int_param` / `parse_bool_param`** | Validate kiểu số/boolean | Chặn các tham số URL không hợp lệ trước khi vào ORM query |
| **`filter_review_status`** | Validate với `ReviewStatus.choices` | Hỗ trợ lọc đơn lẻ hoặc lọc danh sách trạng thái qua `review_status__in` |
| **`filter_work_date_range`** | Dùng `__gte` và `__lte` với `parse_date` | Lọc khoảng thời gian làm việc chính xác đến từng ngày |
| **`filter_search`** | Dùng `Q()` object kết hợp `icontains` | Tìm kiếm đa trường (Mô tả, Task, Email, Họ tên) trong 1 ô input duy nhất |
| **`apply_ordering`** | Whitelist `VALID_ORDER_FIELDS` | Chặn SQL Injection và lỗi server do cố tình sắp xếp theo trường không tồn tại |
