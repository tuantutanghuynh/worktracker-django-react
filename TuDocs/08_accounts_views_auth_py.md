# Executive Code Annotation: `backend/accounts/views_auth.py`

**Package / Module:** `backend.accounts.views_auth` · Auth Controllers & Token Management Views

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm vị von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Định Tuyến Controllers (Auth Controller Endpoint Flow Diagram)

```
                            ┌─────────────────────────────────┐
                            │    Incoming Auth HTTP Requests  │
                            └────────────────┬────────────────┘
                                             │
      ┌──────────────────────────────┬───────┴──────────────────────────────┬──────────────────────────────┐
      │ /login/                      │ /logout/                             │ /forgot-password/            │ /change-password/
      ▼                              ▼                                      ▼                              ▼
┌───────────┐                  ┌───────────┐                          ┌───────────┐                  ┌───────────┐
│ LoginView │                  │LogoutView │                          │ ForgotPass│                  │ ChangePass│
│(AllowAny) │                  │(IsAuth)   │                          │(AllowAny) │                  │(IsAuth)   │
└─────┬─────┘                  └─────┬─────┘                          └─────┬─────┘                  └─────┬─────┘
      │                              │                                      │                              │
      │ 1. Validate Email/Pass       │ 1. Get `jti` and TTL                 │ 1. Gen Token                 │ 1. Verify old pass
      │ 2. Issue Access + Refresh    │ 2. Save `blacklist:jti` in Redis DB 1 │ 2. `send_mail()`             │ 2. Update new pass
      │                              │    with TTL expiry                   │                              │ 3. `log_audit_event()`
      ▼                              ▼                                      ▼                              ▼
 200 OK + Payload               200 OK "Logged out"                    200 OK "If email exists..."     200 OK "Pass changed"
```

> **Vì sao `ChangePasswordView` dùng `permission_classes = [IsAuthenticated]` thuần túy thay vì `HasPermission`?**
> Khi tài khoản bị dính cờ `must_change_password = True` (mật khẩu tạm thời), class `HasPermission` sẽ **chặn tất cả các API** và quăng lỗi 403 `PermissionDenied` ("You must change your password before performing this action"). Nếu `ChangePasswordView` cũng dùng `HasPermission`, chính API dùng để đổi mật khẩu cũng sẽ bị chặn theo, tạo thành một vòng lặp dead-lock (khóa vĩnh viễn không thể đổi password được nữa). Việc dùng `IsAuthenticated` cho phép user đang bị cờ khóa vẫn truy cập được vào duy nhất API Change Password này.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Thư Viện Controllers & Audit Logging

```python
from rest_framework.views import APIView
# "APIView" là CLASS CƠ SỞ theo mô hình CLASS-BASED VIEW (CBV) của DRF: thay vì viết 1 hàm xử lý request như
# Django thuần (function-based view), mỗi endpoint là 1 CLASS kế thừa APIView, và mỗi HTTP verb (GET, POST,
# PUT...) tương ứng với 1 METHOD CÙNG TÊN VIẾT THƯỜNG bên trong class đó (vd `def post(self, request):`).
# Cơ chế `.as_view()` (dùng ở urls_auth.py) sẽ tự route đúng method theo `request.method.lower()`.

from rest_framework.response import Response
# "Response": wrapper của DRF quanh HttpResponse, tự động NEGOTIATE định dạng trả về (JSON mặc định trong
# project này) dựa trên header Accept của client -- không cần tự gọi json.dumps() thủ công.

from rest_framework.permissions import AllowAny, IsAuthenticated
# Import 2 CLASS cùng lúc, cách nhau dấu phẩy. Cả 2 đều dùng ở dạng list `permission_classes = [Class]` bên
# dưới -- DRF tự khởi tạo (instantiate) và gọi `.has_permission()` trên từng class này TRƯỚC khi method
# post()/get() được gọi, y hệt cơ chế "gọi tuần tự các authenticator" đã học ở file authentication.py.

from rest_framework import status
# Import cả MODULE "status" -- bên trong chỉ là các HẰNG SỐ SỐ NGUYÊN có tên dễ đọc (vd status.HTTP_200_OK
# thực chất chỉ là số 200). Dùng tên thay vì số trần giúp code tự giải thích, tránh gõ nhầm mã HTTP.

import time
# Thư viện chuẩn Python -- dùng `time.time()` bên dưới để lấy MỐC THỜI GIAN HIỆN TẠI dạng Unix timestamp
# (số giây trôi qua kể từ 00:00:00 UTC 1/1/1970), khác timezone.now() của Django (trả về đối tượng datetime).

import redis
# Import THẲNG package "redis" (redis-py) -- KHÁC với `.redis_client` import ở dòng dưới (đó là 1 INSTANCE
# kết nối do project tự tạo sẵn). Ở đây chỉ cần "redis" để lấy CLASS EXCEPTION `redis.exceptions.RedisError`
# dùng trong khối try/except bên dưới, không dùng để mở kết nối mới.

from django.core.mail import send_mail
# "send_mail": hàm gửi email có sẵn của Django, tự động dùng backend đã cấu hình qua EMAIL_BACKEND trong
# settings.py (SMTP thật, hoặc console backend chỉ in ra terminal khi DEBUG).

from system.utils import log_audit_event
# Import TUYỆT ĐỐI (absolute import, không có dấu ".") từ 1 APP KHÁC trong project (system, không phải
# accounts) -- Django cho phép các app import lẫn nhau thoải mái, không có ranh giới đóng gói cứng như
# module private của nhiều ngôn ngữ khác. "log_audit_event" ghi vết ai làm gì, lúc nào, từ IP nào.

from .redis_client import redis_client
from .serializers_auth import LoginSerializer, ForgotPasswordSerializer, ResetPasswordSerializer, ChangePasswordSerializer
# Import 4 class Serializer trên CÙNG 1 dòng, cách nhau dấu phẩy -- về cú pháp tương đương viết 4 dòng
# from-import riêng lẻ, chỉ khác cách trình bày. File này là nơi "TIÊU THỤ" (consume) các Serializer đã viết
# ở file 07 -- View không tự validate dữ liệu, mà giao hẳn việc đó cho Serializer.
```

---

### 2. Controller 1 & 2: `LoginView` & `LogoutView`

```python
# Public endpoint: verifies email/password and issues an access + refresh token pair.
class LoginView(APIView):
    permission_classes = [AllowAny]
    # `permission_classes` là 1 LIST chứa CLASS (AllowAny), không phải instance -- DRF tự gọi AllowAny() rồi
    # kiểm tra .has_permission() trước khi post() được gọi. AllowAny luôn trả True -> ai cũng qua được bước
    # kiểm tra quyền, kể cả request KHÔNG có JWT (không đăng nhập vẫn gọi được API này).

    def post(self, request):
    # Tên method "post" (viết thường) là QUY ƯỚC BẮT BUỘC của DRF -- APIView.dispatch() dùng
    # `getattr(self, request.method.lower())` để tìm đúng method xử lý theo HTTP verb của request thực tế.
    # Nếu client gửi GET tới URL này, DRF không tìm thấy method "get" -> tự trả về HTTP 405 Method Not Allowed.
        serializer = LoginSerializer(data=request.data)
        # `request.data` là dict-like object DRF đã tự PARSE sẵn từ JSON body gửi lên (khác request.POST của
        # Django thuần chỉ hiểu form-data). Truyền qua keyword argument `data=` theo đúng signature của
        # Serializer.__init__ đã viết ở file 07.
        serializer.is_valid(raise_exception=True)
        # `.is_valid()` mặc định trả về True/False. Tham số `raise_exception=True` đổi hành vi: nếu dữ liệu
        # KHÔNG hợp lệ, tự động `raise ValidationError` thay vì trả False -- nhờ vậy không cần viết
        # `if not serializer.is_valid(): return Response(serializer.errors, status=400)` thủ công, DRF exception
        # handler tự bắt và convert thành response 400 kèm chi tiết lỗi từng field.

        tokens = serializer.get_tokens()
        return Response(tokens, status=status.HTTP_200_OK)
        # `Response(data, status=...)`: tham số đầu (positional) là dữ liệu Python (ở đây là dict) sẽ được
        # RENDERER của DRF tự serialize thành JSON; `status=` là keyword argument nhận số nguyên (200).
        # Thực thi đăng nhập và trả về cặp Token + Thông tin User Permissions.


# Revokes the current access token immediately by blacklisting its jti in Redis.
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    # `IsAuthenticated` kiểm tra `request.user.is_authenticated` -- nếu Login chưa qua được authenticator ở
    # file authentication.py (token sai/hết hạn/tài khoản bị khóa), request.user sẽ là AnonymousUser -> class
    # này chặn ngay ở đây với HTTP 401/403, method post() bên dưới KHÔNG BAO GIỜ được gọi tới.

    def post(self, request):
        token = request.auth
        # `request.auth` chính là PHẦN TỬ THỨ 2 của tuple mà `WorkTrackerJWTAuthentication.authenticate()`
        # (file authentication.py) đã return: `return user, validated_token` -> DRF gán validated_token này
        # vào request.auth, user vào request.user. Đây là "cầu nối" giữa 2 file, không phải phép màu ngẫu nhiên.

        jti = token["jti"]
        # Subscript access lấy ID token, giống hệt cách đọc jti ở file authentication.py.

        ttl = token["exp"] - int(time.time())
        # `token["exp"]` là claim chuẩn của JWT, kiểu Unix timestamp (int) đánh dấu THỜI ĐIỂM token hết hạn.
        # `time.time()` trả về float (số giây hiện tại, có phần thập phân) -> `int(...)` CẮT BỎ phần thập
        # phân để trừ được với số nguyên `exp`. Kết quả `ttl` = số giây CÒN LẠI trước khi token tự hết hạn.

        if ttl > 0:
        # Chỉ đưa vào blacklist nếu token THỰC SỰ còn hạn (ttl dương) -- nếu token đã hết hạn tự nhiên rồi
        # (ttl <= 0) thì không cần blacklist làm gì nữa (nó đã vô hiệu do hết hạn), tránh gọi Redis với TTL
        # âm hoặc bằng 0 (SETEX với ttl <= 0 sẽ ném lỗi ở phía Redis).
            try:
                redis_client.setex(f"blacklist:{jti}", ttl, "1")
                # `.setex(key, seconds, value)` = SET + EXPIRE gộp thành 1 lệnh Redis DUY NHẤT (atomic), tránh
                # race condition nếu tách 2 lệnh riêng. Giá trị "1" chỉ là PLACEHOLDER bất kỳ -- điều quan
                # trọng là SỰ TỒN TẠI của key (`redis_client.exists(...)` ở file authentication.py chỉ kiểm
                # tra có key hay không, không đọc giá trị bên trong).
                # Đưa `blacklist:<jti>` vào Redis DB 1 với thời gian hết hạn đúng bằng `ttl` còn lại của token.
            except redis.exceptions.RedisError:
                return Response(
                    {"detail": "Logout service temporarily unavailable. Please try again."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
                # `redis.exceptions.RedisError` là CLASS CHA của toàn bộ exception cụ thể trong redis-py (mất
                # kết nối, timeout...) -- bắt đúng class cha này để gộp xử lý mọi loại sự cố Redis chung 1 chỗ.
                # `return` bên trong except THOÁT LUÔN khỏi post() tại đây -- dòng Response 200 OK phía dưới
                # SẼ KHÔNG CHẠY nếu rơi vào nhánh lỗi này.

        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)
        # Dòng này chỉ chạy tới nếu: (a) ttl <= 0 (bỏ qua khối if), hoặc (b) setex() thành công không exception.
```

---

### 3. Controller 3 & 4: `ForgotPasswordView` & `ResetPasswordView`

```python
# Public endpoint: always replies with the same 200 message.
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset = serializer.creat_reset_token()
        # `creat_reset_token()` trả về `None` HOẶC 1 instance `PasswordReset` (xem file 07) -- kiểu trả về
        # KHÔNG ĐỒNG NHẤT (union type None | PasswordReset) là chủ đích, view phải tự if/else theo sau.

        if reset is not None:
            send_mail(
                subject="Reset Password WorkTracker",
                message=f"Use this token to reset password: {reset.token}",
                from_email=None,
                recipient_list=[reset.email],
            )
            # `send_mail(...)` gọi TOÀN BỘ bằng KEYWORD ARGUMENTS (subject=, message=...) dù hàm gốc của
            # Django cho phép gọi vị trí (positional) -- viết theo keyword giúp không nhầm thứ tự tham số.
            # `from_email=None` -> Django tự dùng giá trị DEFAULT_FROM_EMAIL trong settings.py thay vì lỗi.
            # `recipient_list=[reset.email]` PHẢI là 1 LIST (dù chỉ gửi cho 1 người) -- đây là ràng buộc của
            # signature gốc send_mail(), không phải lựa chọn tùy ý; truyền thẳng string sẽ bị lặp từng ký tự
            # thành nhiều "người nhận" vì Django coi string cũng là iterable.
            # f-string `f"...{reset.token}"` nhúng token vừa sinh vào nội dung mail.

        return Response(
            {"detail": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )
        # DÒNG NÀY NẰM NGOÀI khối if -- luôn thực thi dù reset là None hay không, dù nhánh gửi mail có chạy
        # hay không. Đây chính là cách CẤU TRÚC CODE thực thi chống dò quét email: chỉ có 1 return duy nhất
        # cho cả 2 khả năng, client không thể phân biệt được qua response.


# Public endpoint: exchanges a valid reset token for a new password.
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.apply_new_password()
        # Khác ForgotPasswordSerializer.creat_reset_token(), method này LUÔN trả về 1 user hợp lệ (không bao
        # giờ None) -- vì nếu token sai/hết hạn/đã dùng, lỗi đã bị raise từ validate() và is_valid() phía trên
        # chặn lại rồi, code không bao giờ chạy tới dòng này trong trường hợp đó.

        log_audit_event(
            actor=user,
            action="RESET_PASSWORD",
            table_name="users",
            record_id=user.id,
            request=request,
        )
        # Gọi hàm bằng TOÀN BỘ keyword arguments -- suy luận được chữ ký hàm log_audit_event() nhận đúng 5
        # tham số theo tên (actor, action, table_name, record_id, request) dù chưa cần mở file system/utils.py
        # ra đọc. "RESET_PASSWORD" là 1 chuỗi hằng (magic string) dùng làm mã hành động để tra cứu Audit Log sau này.
        # Ghi Audit Log hành vi Reset Password thành công vào CSDL.

        return Response({"detail": "Password has been reset successfully"}, status=status.HTTP_200_OK)
```

---

### 4. Controller 5: `ChangePasswordView` (Đổi Mật Khẩu Cá Nhân)

```python
# Authenticated endpoint: any logged-in user can change their own password.
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    # Dùng `IsAuthenticated` THUẦN (không dùng `HasPermission` như hầu hết view khác trong project) để
    # KHÔNG bị chặn bởi cờ `must_change_password` -- xem lời giải thích chi tiết ở khối "Vì sao" đầu file.

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        # `context={"request": request}` truyền 1 DICT LITERAL trực tiếp làm keyword argument thứ 2 -- khớp
        # đúng với cách ChangePasswordSerializer đọc `self.context["request"].user` đã học ở file 07. Đây là
        # NƠI DUY NHẤT trong 4 serializer cần context, vì nó là serializer duy nhất cần biết "ai đang gọi API"
        # mà không có field nào (token/email) chứa sẵn thông tin đó trong body JSON.
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()
        # Không gán kết quả trả về vào biến nào (khác `user = serializer.apply_new_password()` ở ResetPasswordView)
        # vì method này không return gì cả (xem file 07) -- view đã có sẵn `request.user` để dùng cho audit log
        # bên dưới, không cần lấy lại từ serializer.

        log_audit_event(
            actor=request.user,
            action="CHANGE_PASSWORD",
            table_name="users",
            record_id=request.user.id,
            request=request,
        )
        # Ghi Audit Log hành vi Đổi mật khẩu cá nhân.

        return Response({"detail": "Password changed successfully"}, status=status.HTTP_200_OK)
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Class View / Endpoint | Permission Class | Xử Lý Luồng Dữ Liệu & Tích Hợp Hệ Thống | Phản Hồi HTTP |
|-------------------|------------------|----------------------------------------|---------------|
| **`LoginView`** | `AllowAny` | Gọi `LoginSerializer` kiểm tra pass & xuất Access/Refresh Tokens | 200 OK + JWT Tokens |
| **`LogoutView`** | `IsAuthenticated` | Đưa `jti` vào Redis DB 1 (`setex`) với TTL tự hủy bằng thời gian còn lại | 200 OK / 503 Unavailable |
| **`ForgotPasswordView`** | `AllowAny` | Sinh token reset pass và gửi mail bằng `send_mail()` | 200 OK (Chống leak email) |
| **`ResetPasswordView`** | `AllowAny` | Cập nhật mật khẩu mới & ghi `log_audit_event('RESET_PASSWORD')` | 200 OK |
| **`ChangePasswordView`** | `IsAuthenticated` | Đổi pass, xóa cờ `must_change_password` & ghi `log_audit_event('CHANGE_PASSWORD')` | 200 OK |
