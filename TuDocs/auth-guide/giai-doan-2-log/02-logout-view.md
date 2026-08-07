# 02 — `LogoutView`

## Lấy thông tin token — không tự parse header thủ công

Khi request bay tới được `post()`, DRF + SimpleJWT đã tự xác thực token rồi
(qua `JWTAuthentication` đã cấu hình ở Giai đoạn 1). Token đã giải mã, đã
validate, được gắn sẵn vào `request.auth` — không cần tự đọc header
`Authorization`, không cần tự decode gì cả:

```python
token = request.auth  # instance AccessToken đã được xác thực, hành xử như dict
jti = token["jti"]
exp = token["exp"]
```

Đây là lợi ích thực tế của kiến trúc "Authentication chạy trước View" —
tận dụng lại công đoạn DRF đã làm, không viết lại.

## Vì sao kiểm tra `ttl > 0` trước khi ghi Redis

Về lý thuyết, nếu token đã hết hạn thì `JWTAuthentication` đã tự chặn từ
trước khi vào tới `post()` — nhưng vẫn nên phòng thủ: nếu `exp - now <= 0`
vì lý do nào đó (lệch giờ server, race condition cực hiếm), gọi `SETEX`
với TTL âm/0 sẽ lỗi hoặc vô nghĩa. Bỏ qua bước ghi Redis trong trường hợp
đó — token đằng nào cũng đã hết hạn tự nhiên.

## Vì sao **cần** `try/except` ở đây — khác nguyên tắc Giai đoạn 1

Ở Giai đoạn 1, đã tránh try/except khi có thể tránh (dùng `.filter().first()`
thay vì `.get()`). Ở đây thì ngược lại — `redis_client.setex()` gọi ra một
**hệ thống ngoài** (Redis server) qua network, có khả năng tự nó gặp sự cố
độc lập với logic code. Bắt đúng loại lỗi cụ thể (`redis.exceptions.RedisError`),
không bắt `Exception` chung.

## Code cuối cùng — `backend/accounts/views_auth.py`

```python
import time

import redis
from rest_framework.permissions import AllowAny, IsAuthenticated

from .redis_client import redis_client


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.auth
        jti = token["jti"]
        ttl = token["exp"] - int(time.time())

        if ttl > 0:
            try:
                redis_client.setex(f"blacklist:{jti}", ttl, "1")
            except redis.exceptions.RedisError:
                return Response(
                    {"detail": "Logout service temporarily unavailable. Please try again."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)
```

## Bug thật đã gặp: `return` thành công bị "nhét" sai vào trong khối `if`

Bản gõ lần đầu:

```python
        if ttl > 0:
            try:
                redis_client.setex(f"blacklist:{jti}", ttl, "1")
            except redis.exceptions.RedisError:
                return Response(...)
            
            return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)
```

Dòng `return` thành công thụt lề **bên trong** `if ttl > 0:` — chỉ chạy
khi `ttl > 0`. Nếu rơi vào case `ttl <= 0` (token sắp hết hạn tự nhiên),
hàm `post()` chạy hết mà không gặp `return` nào — Python tự coi như
`return None`.

### Hậu quả nếu không sửa

DRF không nhận `None` là response hợp lệ — `dispatch()` sẽ ném
`AssertionError: Expected a 'Response' object, but received a '<class 'NoneType'>' instead.`
Lỗi này **rất khó phát hiện khi test thủ công**, vì test bình thường
(login rồi logout ngay) luôn có `ttl` còn rất lớn — case `ttl <= 0` chỉ lộ
ra nếu ai đó gọi Logout đúng lúc token gần hết hạn.

### Vì sao đây là lỗi đặc thù Python — liên hệ Java

Ở Java, thụt lề chỉ là trang trí — dấu `{}` mới quyết định 1 dòng thuộc
khối nào. Ở Python, **thụt lề chính là cú pháp** quyết định 1 dòng thuộc
khối nào — lệch 1 cấp thụt lề không phải lỗi trình bày, mà là đổi hẳn ý
nghĩa chương trình.

### Cách sửa

Đưa `return` cuối ra khỏi khối `if`, lùi 1 cấp thụt lề — ngang hàng với
`if ttl > 0:`, luôn chạy tới bất kể có ghi Redis hay không (trừ khi đã
`return` sớm ở nhánh lỗi `RedisError`). Đây chính là bản code cuối cùng ở
trên.
