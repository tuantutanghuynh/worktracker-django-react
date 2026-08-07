# 01 — Setup Redis

## Vì sao cần Redis — nhắc lại

JWT là stateless (đã học ở `auth-guide/02-jwt-and-tokens.md`) — Django
không tự "thu hồi" được token đã phát hành. Redis đóng vai trò bộ nhớ tạm
tốc độ cao để lưu danh sách token đã bị logout (theo `jti`), tra cứu theo
kiểu key-value gần như tức thì (O(1)).

## Cài đặt

```bash
brew install redis
brew services start redis
redis-cli ping   # kỳ vọng: PONG
```

## Vì sao dùng thư viện `redis` thuần, không dùng `django-redis`

Django có sẵn framework `CACHES` để cache query/page. Mục đích ở đây khác —
chỉ cần gọi `SETEX`/`EXISTS` thủ công cho blacklist, không cần các tính
năng cache phức tạp (cache key versioning, serialization...). Dùng thư
viện thuần giúp code rõ ràng "đây là Redis dành riêng cho blacklist".

```bash
pip install redis
pip freeze > requirements.txt
```

## Cấu hình — `backend/worktracker_core/settings.py`

```python
# Redis dùng riêng cho JWT blacklist khi Logout — tách biệt khỏi cache framework của Django
REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6379
REDIS_BLACKLIST_DB = 1  # tách db index riêng, không lẫn với dữ liệu Redis khác nếu sau này dùng thêm việc khác
```

## Connection object dùng chung — `backend/accounts/redis_client.py`

```python
import redis
from django.conf import settings

# A single connection object shared across the entire application
redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_BLACKLIST_DB,
    decode_responses=True, # return str instead of bytes for easier reading
)
```

Một connection object **duy nhất**, dùng lại cho toàn bộ app — giống tư
duy Singleton `DatabaseConfig` quen thuộc bên Java, chỉ khác là thư viện
`redis-py` tự quản lý connection pool bên trong, không cần tự viết logic
singleton tay.

`decode_responses=True` — trả về `str` thay vì `bytes`, để code so sánh
chuỗi (`f"blacklist:{jti}"`) ở các bước sau không phải tự decode.

## Vì sao đặt file ở `accounts/`, không phải 1 thư mục dùng chung

Hiện tại chỉ có luồng Login/Logout của `accounts` cần Redis. Nếu sau này
app khác cũng cần Redis cho việc khác, sẽ refactor di chuyển lên chung —
không tạo sẵn lớp "dùng chung" khi chỉ có 1 nơi dùng.

## Test xác nhận kết nối

```bash
python manage.py shell -c "
from accounts.redis_client import redis_client
redis_client.set('test_key', 'hello')
print(redis_client.get('test_key'))
redis_client.delete('test_key')
"
```

Kết quả: in ra `hello` — xác nhận Django kết nối được Redis.
