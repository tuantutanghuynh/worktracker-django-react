# Executive Code Annotation: `backend/system/services/audit_manager_service.py`

**Package / Module:** `backend.system.services.audit_manager_service` · Enterprise Audit Log Management Service

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (máy quét mã vạch, máy chụp ảnh hiện trạng, bộ lọc địa chỉ nhà, sổ niêm phong...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Quy Trình Kiểm Toán (Audit Management Service Workflow)

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           Business Action Trigger                           │
 │             (VD: Sửa Job, Khóa Kỳ Chấm Công, Phê Duyệt LogWork)             │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                             snapshot(instance)                              │
 │   - Soi `_meta.fields` trích xuất thông tin                                │
 │   - Quy đổi ForeignKey thành `<field>_id`                                   │
 │   - Ép kiểu dữ liệu qua `json_safe()` (xử lý DateTime, Decimal, UUID)       │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         extract_ip_address(request)                         │
 │   - Kiểm tra `HTTP_X_FORWARDED_FOR` (xử lý Nginx/Load Balancer Proxy)        │
 │   - Fallback về `REMOTE_ADDR`                                               │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                    log_action(user, action, table, ...)                     │
 │   - Validate tham số bắt buộc (action, table_name, record_id)              │
 │   - Kiểm tra `user.is_authenticated`                                        │
 │   - Nằm cùng Database Transaction với thao tác chính                        │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                      AuditLog.objects.create(...)                           │
 │                Lưu bản ghi vào PostgreSQL (audit_logs)                      │
 └─────────────────────────────────────────────────────────────────────────────┘
```

> **Vì sao hàm `json_safe` lại cần thực hiện `json.loads(json.dumps(..., cls=DjangoJSONEncoder))`?**
> Thư viện `json` tiêu chuẩn của Python sẽ báo lỗi `TypeError` ngay lập tức khi gặp các kiểu dữ liệu nâng cao của Django như `datetime`, `date`, `Decimal` (dùng cho tiền lương/giờ làm), hoặc `UUID`. Việc dùng `DjangoJSONEncoder` giúp tuần tự hóa (serialize) các kiểu dữ liệu này thành dạng chuỗi chuẩn ISO, sau đó `loads` lại thành dict/list an toàn 100% để lưu vào trường `JSONField` của PostgreSQL.

> **Vì sao hàm `snapshot` lại quy đổi trường ForeignKey thành `<field_name>_id` thay vì lưu toàn bộ đối tượng liên quan?**
> Việc lưu toàn bộ đối tượng ForeignKey (nested serialization) sẽ kéo theo truy vấn N+1 DB và nguy cơ lặp vô tận (infinite recursion). Việc chỉ lưu ID ngắn gọn (`job_id`, `department_id`) giúp ảnh chụp dữ liệu (snapshot) cực kỳ nhẹ, độc lập và dễ dàng query đối soát sau này.

> **Vì sao `extract_ip_address` lại kiểm tra `HTTP_X_FORWARDED_FOR` trước `REMOTE_ADDR`?**
> Trong kiến trúc Deployment thực tế, máy chủ Web (Django Gunicorn) luôn đứng sau một Reverse Proxy như Nginx hoặc Cloudflare. Khi đó, `REMOTE_ADDR` chỉ chứa IP nội bộ của Nginx (`127.0.0.1`). IP thực sự của người dùng được Nginx đính kèm vào header `HTTP_X_FORWARDED_FOR`. Hàm trích xuất IP thông minh này đảm bảo ghi lại đúng IP thực tế của client.

> **Vì sao hàm `log_action` KHÔNG TỰ BẮT ĐẦU `transaction.atomic()` bên trong?**
> Đây là nguyên tắc thiết kế Service nhất quán: Việc ghi Audit Log phải nằm **TRONG CÙNG** giao dịch CSDL (Database Transaction) với hành động nghiệp vụ chính (như sửa Job hay khóa kỳ chấm công). Nếu hành động chính bị lỗi rollback, bản ghi audit log cũng phải rollback theo. Nếu `log_action` tự tạo transaction riêng, nó sẽ làm sai lệch tính toàn vẹn dữ liệu của giao dịch cha.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Hàm Chuyển Đổi Dữ Liệu An Toàn (`json_safe`)

```python
import json
# "import json" = Nhập thư viện xử lý chuỗi JSON tiêu chuẩn của Python.

from django.core.serializers.json import DjangoJSONEncoder
# "from django.core.serializers.json import DjangoJSONEncoder" = Nhập bộ mã hóa JSON chuyên dụng của Django.
# Bộ mã hóa này biết cách chuyển đổi các kiểu dữ liệu đặc thù của Django/Python (datetime, Decimal, UUID) thành chuỗi JSON readable.

from system.models import AuditLog
# Nhập model `AuditLog` để thực hiện thao tác lưu log vào DB.


def json_safe(value):
    """
    Chuyển dữ liệu Python/Django sang dạng JSON-safe.

    Xử lý được:
    - date/datetime
    - Decimal
    - UUID
    - các kiểu DjangoJSONEncoder hỗ trợ
    """
    return json.loads(
        json.dumps(value, cls=DjangoJSONEncoder)
    )
    # "json.dumps(value, cls=DjangoJSONEncoder)" = Chuyển đối tượng `value` thành chuỗi JSON bằng bộ mã hóa Django.
    # "json.loads(...)" = Giải mã chuỗi JSON đó trở lại thành cấu hình Python primitive (dict, list, str, int, float).
    # Kết quả trả về là một cấu trúc dữ liệu thuần túy an toàn 100% khi gán vào `JSONField`.
```

---

### 2. Hàm Chụp Ảnh Trạng Thái Dữ Liệu (`snapshot`)

```python
def snapshot(instance, fields=None):
    """
    Chụp trạng thái hiện tại của model instance.

    Nếu fields=None:
        chụp toàn bộ concrete fields.

    Nếu field là ForeignKey:
        lưu dạng <field>_id thay vì serialize object.
    """
    if instance is None:
        return None
        # "if instance is None: return None" = Kiểm tra nếu đối tượng truyền vào là `None` (VD: hành động tạo mới không có old_values), trả về `None` ngay lập tức.

    model_fields = {
        field.name: field
        for field in instance._meta.fields
    }
    # "instance._meta.fields" = Truy cập metadata của Django ORM để lấy danh sách toàn bộ các trường vật lý của model.
    # Comprehension `{field.name: field ...}` = Tạo từ điển ánh xạ từ tên trường sang đối tượng trường.

    if fields is None:
        fields = list(model_fields.keys())
        # "if fields is None:" = Nếu người dùng không chỉ định danh sách trường cần chụp, mặc định chụp TOÀN BỘ các trường của model.

    data = {}
    # "data = {}" = Khởi tạo dictionary rỗng để chứa dữ liệu ảnh chụp.

    for field_name in fields:
    # "for field_name in fields:" = Duyệt qua từng tên trường cần chụp ảnh.

        field = model_fields.get(field_name)
        # Lấy đối tượng field tương ứng từ `model_fields`.

        if field is not None and field.is_relation:
        # "if field is not None and field.is_relation:" = Kiểm tra xem trường này có phải là quan hệ khóa ngoại (ForeignKey / OneToOne) hay không.

            data[f"{field_name}_id"] = getattr(
                instance,
                f"{field_name}_id",
                None,
            )
            # "getattr(instance, f'{field_name}_id', None)" = Lấy trực tiếp ID của đối tượng liên quan (VD: `job_id` thay vì lấy cả object `Job`).
            # Lưu vào dictionary với khóa dạng `user_id`, `job_id`, `department_id`.

        else:
            data[field_name] = getattr(instance, field_name, None)
            # "data[field_name] = getattr(...)" = Với các trường dữ liệu thông thường (CharField, IntegerField...), lấy giá trị trực tiếp từ instance.

    return json_safe(data)
    # "return json_safe(data)" = Đưa toàn bộ dictionary dữ liệu vừa chụp qua hàm `json_safe` để đảm bảo không lỗi kiểu dữ liệu trước khi trả về.
```

---

### 3. Hàm Trích Xuất Địa Chỉ IP (`extract_ip_address`)

```python
def extract_ip_address(request):
    """
    Lấy IP từ request.

    ip_address trong AuditLog cho phép null,
    nên nếu không có request thì trả None.
    """
    if request is None:
        return None
        # Nếu không có đối tượng request (chạy ngầm), trả về `None`.

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    # "request.META.get('HTTP_X_FORWARDED_FOR')" = Tìm kiếm header proxy `X-Forwarded-For`.

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
        # "forwarded_for.split(',')[0].strip()" = Chuỗi `X-Forwarded-For` có thể chứa nhiều IP nối nhau qua dấu phẩy (client, proxy1, proxy2).
        # Tách lấy IP ĐẦU TIÊN (chính là IP gốc của thiết bị người dùng) và xóa khoảng trắng dư thừa.

    return request.META.get("REMOTE_ADDR")
    # Nếu không có header proxy, trả về địa chỉ IP kết nối trực tiếp `REMOTE_ADDR`.
```

---

### 4. Hàm Ghi Nhật Ký Kiểm Toán Chính (`log_action`)

```python
def log_action(
    *,
    user,
    action,
    table_name,
    record_id,
    old_values=None,
    new_values=None,
    request=None,
):
    """
    Ghi audit log.

    Lưu ý:
    - Hàm này KHÔNG tự mở transaction.atomic().
    - View/service gọi hàm này phải đặt bên trong cùng transaction
      với thao tác chính.
    """
    # "*," = Cú pháp bắt buộc tất cả các tham số khi gọi hàm `log_action` đều PHẢI truyền dạng Keyword Arguments (VD: `log_action(user=u, action='A', ...)`).
    # Giúp code rõ ràng, tránh truyền nhầm thứ tự tham số.

    if not action:
        raise ValueError("action is required.")
        # "if not action:" = Kiểm tra mã hành động không được để rỗng. Nếu rỗng raise lỗi `ValueError`.

    if not table_name:
        raise ValueError("table_name is required.")
        # Kiểm tra tên bảng không được để rỗng.

    if record_id is None:
        raise ValueError("record_id is required.")
        # Kiểm tra ID bản ghi bị tác động không được để None.

    return AuditLog.objects.create(
    # Thực hiện tạo bản ghi AuditLog trong CSDL:

        user=user if getattr(user, "is_authenticated", False) else None,
        # "getattr(user, 'is_authenticated', False)" = Kiểm tra an toàn xem `user` có đăng nhập hợp lệ hay không.
        # Nếu là AnonymousUser hoặc None, gán `user = None`.

        action=action,
        # Gán mã hành động.

        table_name=table_name,
        # Gán tên bảng vật lý.

        record_id=record_id,
        # Gán ID bản ghi.

        old_values=json_safe(old_values) if old_values is not None else None,
        # Nếu có `old_values`, chuẩn hóa qua `json_safe` rồi gán vào trường `old_values`.

        new_values=json_safe(new_values) if new_values is not None else None,
        # Nếu có `new_values`, chuẩn hóa qua `json_safe` rồi gán vào trường `new_values`.

        ip_address=extract_ip_address(request),
        # Trích xuất địa chỉ IP bằng hàm `extract_ip_address(request)`.
    )
    # Trả về đối tượng `AuditLog` vừa được khởi tạo thành công.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Hàm Service | Tham Số Đặt Tên (Keyword Args) | Mục Đích & Cơ Chế Xử Lý | Điểm Chú Ý Về Nghiệp Vụ & An Toàn |
|---|---|---|---|
| **`json_safe`** | `value` | Chuyển đổi dữ liệu Python/Django sang JSON-safe bằng `DjangoJSONEncoder` | Xử lý triệt để các kiểu `datetime`, `Decimal`, `UUID` tránh crash app |
| **`snapshot`** | `instance`, `fields=None` | Tự động quét `_meta.fields` chụp ảnh trạng thái CŨ/MỚI của Model | Tự đổi ForeignKey thành `<field>_id`, tối ưu dung lượng snapshot |
| **`extract_ip_address`** | `request` | Trích xuất IP người dùng qua `X-Forwarded-For` hoặc `REMOTE_ADDR` | Đảm bảo lấy đúng IP thật kể cả khi chạy sau Nginx Reverse Proxy |
| **`log_action`** | `*, user, action, table_name, record_id, old_values, new_values, request` | Kiểm tra tính hợp lệ và lưu bản ghi `AuditLog` vào PostgreSQL | Bắt buộc tham số Keyword-only (`*`), chạy chung Transaction với thao tác chính |
