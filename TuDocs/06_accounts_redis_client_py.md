# Executive Code Annotation: `backend/accounts/redis_client.py`

**Package / Module:** `backend.accounts.redis_client` · Standalone Redis Connection Singleton for JWT Blacklist

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm vị von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Độc Lập Bộ Kết Nối Redis (Redis Connection Isolation Diagram)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Django Application Process                            │
│                                                                                        │
│  ┌─────────────────────────────┐                         ┌──────────────────────────┐  │
│  │   django.core.cache (CACHES)│                         │   accounts.redis_client  │  │
│  │   Redis DB 2 (User Cache)   │                         │   Redis DB 1 (Blacklist) │  │
│  └──────────────┬──────────────┘                         └────────────┬─────────────┘  │
└─────────────────┼─────────────────────────────────────────────────────┼────────────────┘
                  │                                                     │
                  ▼                                                     ▼
┌───────────────────────────────────┐                 ┌───────────────────────────────────┐
│     Redis Server (127.0.0.1)      │                 │     Redis Server (127.0.0.1)      │
│      Database 2: CACHES           │                 │      Database 1: BLACKLIST        │
│   (Xóa sạch khi flushdb/cache)    │                 │  (An toàn, không bị flush nhầm)   │
└───────────────────────────────────┘                 └───────────────────────────────────┘
```

> **Vì sao tạo `redis_client` dùng thư viện `redis-py` trực tiếp thay vì xài qua `django.core.cache`?**
> Thư viện `django.core.cache` mặc định quản lý bộ nhớ tạm (Cache), khi cần xóa cache ứng dụng hoặc khi hết dung lượng, hệ thống có thể chạy lệnh `cache.clear()` / `flushdb`. Nếu lưu danh sách đen Token JWT (Blacklist Logout) chung vào bộ nhớ cache đó, khi cache bị xóa, tất cả các Token đã vô hiệu hóa sẽ "sống lại" và dùng lại được. Việc tạo `redis_client` kết nối độc lập tới **Redis DB 1** giúp tách biệt hoàn toàn danh sách đen Token khỏi bộ nhớ tạm của hệ thống.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Thư Viện Redis & Django Settings

```python
import redis
# "import redis": Thư viện Python chính thức (`redis-py`) chuyên dùng để kết nối và gửi câu lệnh tới máy chủ Redis.

from django.conf import settings
# "from django.conf import settings": Mượn file cấu hình trung tâm của Django để đọc các thông số kết nối Redis (Host, Port, DB number).
```

---

### 2. Khởi Tạo Singleton Connection `redis_client`

```python
# This file holds the Redis connection used only for the JWT logout blacklist
# (not Django's cache framework). A single shared client is created once here
# and imported wherever it's needed, instead of opening a new connection per call.
redis_client = redis.Redis(
# "redis_client = redis.Redis(...)" = Tạo một đối tượng kết nối Singleton dùng chung cho toàn ứng dụng.
# Biến này chỉ được khởi tạo 1 lần duy nhất khi ứng dụng boot up, giúp tái sử dụng Connection Pool,
# không bắt máy chủ phải mở lại kết nối TCP mới ở mỗi request API.

    host=settings.REDIS_HOST,
    # "host=settings.REDIS_HOST": Địa chỉ IP máy chủ Redis (lấy từ settings: '127.0.0.1').

    port=settings.REDIS_PORT,
    # "port=settings.REDIS_PORT": Cổng kết nối Redis (lấy từ settings: 6379).

    db=settings.REDIS_BLACKLIST_DB,
    # "db=settings.REDIS_BLACKLIST_DB": Chọn chính xác cơ sở dữ liệu số 1 (DB 1) dành riêng cho Blacklist Token Logout.

    decode_responses=True,
    # "decode_responses=True": Tự động giải mã dữ liệu nhận về từ Redis thành dạng chuỗi văn bản (`str` Tiếng Việt / UTF-8)
    # thay vì trả về dạng chuỗi byte thô (`b'...'`), giúp code ngắn gọn và dễ đọc hơn.
)
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Thông Số Cấu Hình | Giá Trị Truy Xuất | Ý Nghĩa Kỹ Thuật & Kiến Trúc |
|-------------------|------------------|-----------------------------|
| **Thư viện kết nối** | `redis.Redis` (redis-py) | Kết nối TCP trực tiếp tới Redis Server, không qua lớp đệm Django Cache Framework |
| **Mẫu thiết kế (Pattern)** | Singleton Instance | Khởi tạo 1 lần duy nhất toàn app, tối ưu Connection Pooling |
| **CSDL Redis Target** | `db=1` (`REDIS_BLACKLIST_DB`) | Tách biệt tuyệt đối dữ liệu Blacklist Logout với dữ liệu Cache ứng dụng (DB 2) |
| **Kiểu dữ liệu trả về** | `decode_responses=True` | Tự động chuyển đổi Python Bytes thành String UTF-8 chuẩn xác |
