# 09 — Roadmap chi tiết Giai đoạn 2: Logout & Redis Blacklist

Giai đoạn 1 đã xong (Login/Refresh). Giai đoạn 2 giải quyết vấn đề còn để
ngỏ ở `auth-guide/02-jwt-and-tokens.md`: JWT là stateless, Django không thể
"thu hồi" một token đã phát hành — cần một blacklist để Logout có tác dụng
thật, không chỉ là xóa token ở phía Frontend.

## Mục tiêu cuối Giai đoạn 2

Sau khi user bấm Logout, access token họ đang dùng phải **mất tác dụng
ngay lập tức** — không phải chờ 15 phút để nó tự hết hạn.

## Kỹ thuật sẽ dùng (đã học ở `02-jwt-and-tokens.md`, giờ áp dụng thật)

```text
Logout
 ↓
Lấy JTI (JWT ID) từ token đang dùng
 ↓
Redis: SETEX blacklist:<jti> <thời_gian_còn_lại_của_token> "1"
 ↓
Các request sau dùng token này → check Redis thấy jti bị blacklist → 401
```

Lưu ý: đây là blacklist Redis **tự code**, khác với blacklist Postgres của
thư viện SimpleJWT đã cấu hình ở Giai đoạn 1 (`BLACKLIST_AFTER_ROTATION`) —
2 cơ chế độc lập, đã phân biệt rõ ở `giai-doan-1-log/01-cau-hinh-settings.md`.

## 4 việc cần làm, chia theo 3 ngày

### Ngày 1 — Setup Redis

Cài Redis server (`brew install redis` trên Mac) + thư viện Python kết nối
(`redis` hoặc `django-redis`). Cấu hình connection trong `settings.py`. Xác
nhận kết nối được bằng 1 lệnh `SET`/`GET` thử nghiệm trước khi viết logic
thật — tách riêng "Redis chạy được chưa" khỏi "logic Logout đúng chưa", để
nếu có lỗi thì biết ngay lỗi nằm ở đâu.

### Ngày 2 — API Logout (ghi vào blacklist)

```text
[1] FE: POST /api/auth/logout/ (gửi kèm Access Token hiện tại trong header)
[2] BE: Lấy chuỗi token từ header "Authorization: Bearer <token>"
[3] BE: Giải mã token (không cần verify lại signature — DRF middleware đã
        làm rồi nếu request lọt qua được tới đây), lấy claim "jti" và "exp"
[4] BE: Tính TTL = exp - now (giây) — đây chính là "thời gian còn lại" của
        token, để Redis tự dọn key khi token đằng nào cũng sắp hết hạn
[5] BE: Redis SETEX blacklist:<jti> TTL "1"
[6] BE: trả 200 OK
```

Pseudocode hướng triển khai (không phải code cuối, sẽ chốt khi vào code thật):

```python
class LogoutView(APIView):
    def post(self, request):
        token = request.auth  # DRF tự gắn AccessToken đã validate vào request.auth
        jti = token["jti"]
        ttl = token["exp"] - int(time.time())
        redis_client.setex(f"blacklist:{jti}", ttl, "1")
        return Response(status=status.HTTP_200_OK)
```

### Ngày 2-3 — Custom Authentication: chặn token đã bị blacklist

Đây là phần quan trọng nhất — nếu thiếu bước này, Redis có ghi blacklist
cũng vô nghĩa vì không ai tra cứu nó. Cần viết 1 class kế thừa
`JWTAuthentication` của SimpleJWT, override để **tự thêm 1 bước kiểm tra
Redis** trước khi chấp nhận token:

```python
class BlacklistAwareJWTAuthentication(JWTAuthentication):
    def get_validated_token(self, raw_token):
        validated_token = super().get_validated_token(raw_token)
        jti = validated_token["jti"]
        if redis_client.exists(f"blacklist:{jti}"):
            raise AuthenticationFailed("Token has been revoked.")
        return validated_token
```

Sau đó đổi `DEFAULT_AUTHENTICATION_CLASSES` trong `settings.py` để trỏ tới
class mới này thay vì `JWTAuthentication` gốc.

### Ngày 3 — Integration test toàn luồng

```text
[1] Login → nhận access + refresh
[2] Gọi 1 API cần xác thực bằng access token đó → phải thành công (200)
[3] Logout bằng access token đó
[4] Gọi LẠI API ở bước [2] bằng CÙNG access token → phải bị từ chối (401)
[5] Login lại (sinh access token MỚI) → gọi API → vẫn thành công (200)
```

Bước [5] quan trọng để xác nhận blacklist chỉ chặn đúng token cụ thể đã
logout, không chặn nhầm toàn bộ user.

## Việc KHÔNG làm trong Giai đoạn 2 (để khỏi lan phạm vi)

- Chưa làm Offboarding (Admin khóa tài khoản kèm thu hồi token) — đó là
  Giai đoạn 5 trong roadmap tổng (`08-roadmap-and-talking-points.md`), dù
  dùng lại đúng cơ chế blacklist này.
- Chưa làm Audit Log cho hành vi Logout — Giai đoạn 6.

## Rủi ro cần lưu ý khi trình bày với team

Nếu Redis server bị crash hoặc mất dữ liệu, mọi token đã logout coi như
"được mở khóa lại" — đây là giới hạn đã biết của kiến trúc (đã nói ở
`02-jwt-and-tokens.md`, câu hỏi tự kiểm tra số 1), không phải bug cần sửa
ngay, nhưng nên ghi nhận để team biết đây là điểm cần giám sát khi lên
production (Redis cần persistence hoặc replica).
