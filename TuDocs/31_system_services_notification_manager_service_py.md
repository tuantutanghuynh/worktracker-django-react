# Executive Code Annotation: `backend/system/services/notification_manager_service.py`

**Package / Module:** `backend.system.services.notification_manager_service` · Central Notification Manager Service

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (trung tâm bưu điện, màng lọc thư rác, người vận chuyển best-effort, hệ thống phát thanh...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Quy Trình Phát Thông Báo (Notification Dispatch Workflow Diagram)

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                            Trigger Business Event                           │
  │     (VD: Giao Task, Đổi Status Task, Phê Duyệt/Từ Chối Chấm Công...)        │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                    resolve_task_recipients(task, actor)                     │
  │   - Tập hợp: Assignee + Creator + Job Manager + Task Followers              │
  │   - Loại bỏ chính `actor` thực hiện hành động (không tự thông báo cho mình) │
  │   - Lọc duy nhất người dùng ĐANG HOẠT ĐỘNG (`is_active=True`)              │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                         notify(recipients, event, ...)                      │
  │   - Validate event_type & channel_type                                      │
  │   - Khởi tạo danh sách đối tượng Notification                               │
  │   - Ghi hàng loạt vào CSDL qua `Notification.objects.bulk_create()`         │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │                                           │
                   ▼                                           ▼
  ┌─────────────────────────────────┐         ┌─────────────────────────────────┐
  │   push_realtime_best_effort()   │         │    enqueue_email_best_effort()   │
  │ - Đẩy tin nhắn WebSocket in-app │         │ - Đẩy task Celery gửi email     │
  │ - Bọc try-except: Không bao giờ │         │ - (Chỉ chạy khi channel = EMAIL/│
  │   làm hỏng Transaction chính    │         │   ALL, bọc try-except an toàn)  │
  └─────────────────────────────────┘         └─────────────────────────────────┘
```

> **Vì sao ứng dụng lại ưu tiên lưu `Notification` vào CSDL trước (`bulk_create`), còn việc đẩy Realtime/Email lại đặt trong cơ chế Best-Effort (`try...except`)?**
> Đây là nguyên tắc bảo vệ tính toàn vẹn nghiệp vụ (Business Transaction Integrity): Việc lưu thông báo vào database là bắt buộc (persist). Tuy nhiên, nếu dịch vụ WebSocket bị chập chờn hoặc Server Email SMTP bị nghẽn mạng, lỗi gửi tin nhắn **KHÔNG ĐƯỢC PHÉP** làm sập (rollback) hành động chính của người dùng (như hành động phê duyệt công việc hay khóa kỳ chấm công). Cơ chế Best-Effort đảm bảo thông báo luôn được lưu an toàn trong DB để người dùng đọc lại sau, dù kết nối thời gian thực có gián đoạn.

> **Vì sao hàm `resolve_task_recipients` phải chủ động loại bỏ `exclude_user` (người thực hiện hành động)?**
> Hãy hình dung khi một Quản lý phê duyệt một báo cáo công việc (Task Approved), chính vị Quản lý đó là người vừa bấm nút. Việc gửi một thông báo "Bạn vừa phê duyệt công việc X" cho chính Quản lý đó là thừa thãi và gây rác hộp thư. Việc loại trừ `exclude_user` giúp thông báo chỉ hướng tới đúng những người có liên quan thực sự cần biết tin tức.

> **Vì sao dịch vụ bắt buộc phải lọc `is_active=True` cho tất cả người nhận thông báo?**
> Nhân viên đã nghỉ việc hoặc bị khóa tài khoản (`is_active=False`) không còn quyền truy cập vào hệ thống WorkTracker. Việc lọc bỏ các tài khoản inactive giúp tiết kiệm tài nguyên hệ thống (không tạo bản ghi DB rác, không gửi email vô nghĩa) và đảm bảo an toàn thông tin doanh nghiệp.

> **Vì sao lại dùng `Notification.objects.bulk_create(notifications)` thay vì dùng vòng lặp `for` để `save()` từng thông báo?**
> Nếu một công việc có 10 người theo dõi (followers) + 1 người tạo + 1 người nhận + 1 quản lý (tổng cộng 13 người), việc dùng vòng lặp `save()` sẽ tạo ra 13 câu lệnh SQL `INSERT INTO notifications`. Việc dùng `bulk_create` gộp tất cả thành đúng **1 câu lệnh SQL duy nhất**, giảm 90% độ trễ I/O của database.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Các Hàm Trợ Lý Chuẩn Hóa & Kiểm Định Dữ Liệu

```python
from django.contrib.auth import get_user_model
# "from django.contrib.auth import get_user_model" = Nhập hàm lấy model User chính thức của hệ thống (CustomUser).

from system.models import Notification
# Nhập model Notification từ app `system`.

from tasks.models import TaskFollower
# Nhập model `TaskFollower` từ app `tasks` để lấy danh sách những người đang theo dõi công việc.


def normalize_user_id(user_or_id):
    """
    Nhận user object hoặc user id.
    Trả về user id.
    """
    if user_or_id is None:
        return None
        # Nếu đầu vào là `None`, trả về `None`.

    if isinstance(user_or_id, int):
        return user_or_id
        # "isinstance(user_or_id, int)" = Nếu đầu vào đã là một số nguyên (User ID), trả về trực tiếp số nguyên đó.

    return getattr(user_or_id, "id", None)
    # Nếu đầu vào là một đối tượng CustomUser (hoặc object bất kỳ), trích xuất trường `.id`. Nếu không có trả về `None`.


def unique_user_ids(users):
    """
    Loại trùng user id và bỏ giá trị None.
    """
    result = []
    # Khởi tạo danh sách kết quả chứa các User ID duy nhất.

    for item in users:
    # Duyệt qua từng phần tử trong danh sách người dùng truyền vào.

        user_id = normalize_user_id(item)
        # Chuẩn hóa phần tử về dạng số nguyên ID.

        if user_id and user_id not in result:
            result.append(user_id)
            # Nếu user_id hợp lệ (không None/0) và chưa có trong `result`, thêm vào danh sách.

    return result
    # Trả về danh sách các User ID đã được lọc trùng và loại bỏ `None`.


def validate_event_type(event_type):
    valid_event_types = {
        value
        for value, label in Notification.EventType.choices
    }
    # Set Comprehension: Trích xuất danh sách tất cả các giá trị hợp lệ từ `Notification.EventType.choices`.

    if event_type not in valid_event_types:
        raise ValueError(f"Invalid notification event_type: {event_type}")
        # Nếu `event_type` truyền vào nằm ngoài danh sách enum, bắn lỗi `ValueError` dừng chương trình.


def validate_channel(channel):
    valid_channels = {
        value
        for value, label in Notification.ChannelType.choices
    }
    # Trích xuất danh sách các kênh phân phối hợp lệ từ `Notification.ChannelType.choices`.

    if channel not in valid_channels:
        raise ValueError(f"Invalid notification channel: {channel}")
        # Nếu kênh không hợp lệ, bắn lỗi `ValueError`.
```

---

### 2. Các Hàm Phân Phối Realtime & Email (Best-Effort Layer)

```python
def push_realtime_best_effort(notifications):
    """
    Placeholder cho Django Channels.

    Giai đoạn này chưa triển khai Channels vì chưa có consumer/routing.
    Khi có WebSocket layer, bổ sung code gửi group theo user_id ở đây.

    Hàm này không được raise lỗi làm hỏng transaction chính.
    """
    try:
        # Khối `try...except` bao bọc toàn bộ logic đẩy tin nhắn WebSocket:
        # TODO: Khi tích hợp Django Channels, bổ sung logic gửi thông báo tới WebSocket room `user_<user_id>`.
        return None
    except Exception:
        return None
        # "except Exception: return None" = Bắt mọi ngoại lệ có thể xảy ra và bỏ qua an toàn.
        # Đảm bảo trục trặc WebSocket KHÔNG BAO GIỜ làm crash giao dịch nghiệp vụ chính.


def enqueue_email_best_effort(notifications):
    """
    Placeholder cho Celery email task.

    Khi có Celery task gửi mail, bổ sung enqueue ở đây.
    Hàm này không được raise lỗi làm hỏng transaction chính.
    """
    try:
        # Khối `try...except` bao bọc toàn bộ logic đẩy task gửi email vào hàng đợi Celery:
        # TODO: Khi có Celery, bổ sung: `send_notification_email_task.delay(notification.id)`.
        return None
    except Exception:
        return None
        # Bắt mọi ngoại lệ an toàn, tuyệt đối không làm ảnh hưởng đến luồng chính.
```

---

### 3. Hàm Phát Thông Báo Trung Tâm (`notify`)

```python
def notify(
    *,
    recipients,
    event_type,
    title,
    content=None,
    related_url=None,
    channel=Notification.ChannelType.SYSTEM_ONLY,
):
    """
    Tạo notification cho danh sách recipients.

    Quy tắc:
    - Persist DB trước.
    - Realtime/email là best-effort.
    - Không tự rollback thao tác nghiệp vụ nếu realtime/email lỗi.
    """
    # Keyword-only arguments (`*`): Bắt buộc người gọi truyền đầy đủ tên tham số.

    validate_event_type(event_type)
    # Kiểm tra tính hợp lệ của mã sự kiện nghiệp vụ.

    validate_channel(channel)
    # Kiểm tra tính hợp lệ của kênh phát thông báo.

    recipient_ids = unique_user_ids(recipients)
    # Lọc trùng và chuẩn hóa danh sách ID người nhận.

    if not recipient_ids:
        return []
        # Nếu danh sách người nhận rỗng, trả về danh sách rỗng `[]` ngay lập tức.

    User = get_user_model()
    # Lấy model User chính thức (`CustomUser`).

    active_user_ids = list(
        User.objects.filter(
            id__in=recipient_ids,
            is_active=True,
        ).values_list("id", flat=True)
    )
    # Truy vấn CSDL lọc ra các User ID thỏa mãn 2 điều kiện:
    # 1. `id__in=recipient_ids`: Nằm trong danh sách người nhận.
    # 2. `is_active=True`: Tài khoản đang hoạt động (không bị khóa hay sa thải).
    # `.values_list('id', flat=True)` = Chỉ lấy danh sách các số ID dạng phẳng `[12, 15, 20]`.

    notifications = [
        Notification(
            user_id=user_id,
            event_type=event_type,
            type=channel,
            title=title,
            content=content,
            related_url=related_url,
        )
        for user_id in active_user_ids
    ]
    # List Comprehension: Khởi tạo danh sách đối tượng `Notification` trong bộ nhớ RAM cho mỗi `user_id` hoạt động.

    created_notifications = Notification.objects.bulk_create(notifications)
    # "Notification.objects.bulk_create(notifications)" = Ghi toàn bộ danh sách thông báo vào PostgreSQL bằng 1 câu lệnh SQL `INSERT` duy nhất.

    push_realtime_best_effort(created_notifications)
    # Đẩy thông báo thời gian thực qua WebSocket (Best-effort).

    if channel in {
        Notification.ChannelType.EMAIL_ONLY,
        Notification.ChannelType.ALL,
    }:
        enqueue_email_best_effort(created_notifications)
        # Nếu kênh yêu cầu gửi email (`EMAIL_ONLY` hoặc `ALL`), đẩy task gửi mail vào hàng đợi (Best-effort).

    return created_notifications
    # Trả về danh sách các đối tượng `Notification` vừa được khởi tạo thành công trong DB.
```

---

### 4. Hàm Xác Định Người Nhận Cho Công Việc (`resolve_task_recipients`)

```python
def resolve_task_recipients(task, exclude_user=None):
    """
    Xác định người nhận notification cho task event.

    Gồm:
    - assignee (Người được giao việc)
    - creator (Người tạo ra task)
    - manager của job (Quản lý dự án)
    - followers của task (Những người bấm theo dõi task)

    exclude_user:
    - dùng để không gửi thông báo cho chính người vừa thực hiện hành động.
    """
    exclude_user_id = normalize_user_id(exclude_user)
    # Chuẩn hóa ID của người thực hiện hành động cần loại trừ.

    user_ids = []
    # Khởi tạo danh sách gom các User ID liên quan.

    if task.assignee_id:
        user_ids.append(task.assignee_id)
        # Nếu task có người nhận việc (`assignee`), thêm `assignee_id` vào danh sách.

    if task.creator_id:
        user_ids.append(task.creator_id)
        # Nếu task có người tạo (`creator`), thêm `creator_id` vào danh sách.

    if task.job_id and task.job.manager_id:
        user_ids.append(task.job.manager_id)
        # Nếu task thuộc một Dự án (`Job`) và Dự án đó có Quản lý (`manager`), thêm `manager_id` vào danh sách.

    follower_user_ids = TaskFollower.objects.filter(
        task_id=task.id
    ).values_list("user_id", flat=True)
    # Truy vấn bảng `task_followers` lấy danh sách User ID của những người đăng ký theo dõi công việc này.

    user_ids.extend(list(follower_user_ids))
    # Nối danh sách người theo dõi vào danh sách tổng `user_ids`.

    unique_ids = unique_user_ids(user_ids)
    # Khử trùng lặp và loại bỏ các giá trị `None`.

    if exclude_user_id:
        unique_ids = [
            user_id
            for user_id in unique_ids
            if user_id != exclude_user_id
        ]
        # List Comprehension: Loại bỏ `exclude_user_id` ra khỏi danh sách người nhận (tránh tự gửi thông báo cho chính mình).

    User = get_user_model()
    # Lấy model `CustomUser`.

    return User.objects.filter(
        id__in=unique_ids,
        is_active=True,
    )
    # Truy vấn CSDL trả về QuerySet chứa các đối tượng User đang hoạt động (`is_active=True`).
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Hàm Service | Đầu Vào Chính | Đầu Ra Trả Về | Ý Nghĩa Kỹ Thuật & Nghiệp Vụ |
|---|---|---|---|
| **`normalize_user_id`** | User object hoặc `int` ID | `int` ID hoặc `None` | Chuẩn hóa kiểu dữ liệu đầu vào người dùng về dạng ID số nguyên duy nhất |
| **`unique_user_ids`** | Danh sách user/IDs | Danh sách ID duy nhất | Loại bỏ trùng lặp và loại bỏ `None` trong danh sách người nhận thông báo |
| **`notify`** | `recipients`, `event_type`, `title`, `content`, `related_url`, `channel` | Danh sách `Notification` | Hàm phát thông báo trung tâm: ghi DB bằng `bulk_create`, kích hoạt WebSocket & Email best-effort |
| **`push_realtime_best_effort`** | Danh sách `Notification` | `None` | Đẩy tin nhắn realtime in-app qua WebSocket; bọc `try...except` để bảo vệ transaction chính |
| **`enqueue_email_best_effort`** | Danh sách `Notification` | `None` | Đẩy task gửi email vào hàng đợi Celery; bọc `try...except` an toàn tuyệt đối |
| **`resolve_task_recipients`** | `task`, `exclude_user` | QuerySet User active | Gom tập hợp đầy đủ người liên quan tới Task (Assignee, Creator, Manager, Followers) trừ actor thực hiện |
