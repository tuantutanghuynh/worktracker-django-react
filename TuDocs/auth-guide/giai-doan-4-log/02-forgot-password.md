# 02 — `ForgotPasswordSerializer` & `ForgotPasswordView`

## Vì sao gửi email ở `View`, không gửi trong `Serializer`

Serializer nên tập trung vào "validate dữ liệu + chuẩn bị kết quả" — gửi
email là một tác vụ I/O phụ (gọi ra ngoài hệ thống, giống gọi Redis ở Giai
đoạn 2). Tách nó ra `View` giúp `Serializer` dễ test độc lập, không cần
giả lập việc gửi mail mỗi lần kiểm tra logic sinh token.

## Vì sao trả về `None` nếu không tìm thấy email, không `raise` lỗi gì

Đây là logic, không phải lỗi — đúng tinh thần đã học ở `LoginSerializer`
(`.filter().first()` thay vì `.get()`). Quan trọng hơn: phải luôn trả
**200 OK** ở `View` dù tìm thấy email hay không, để không lộ ra "email này
có tồn tại trong hệ thống hay không" (anti user-enumeration).

## Code cuối cùng

```python
# backend/accounts/serializers_auth.py
import secrets
from datetime import timedelta
from django.utils import timezone
from .models import PasswordReset


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def creat_reset_token(self):
        email = self.validated_data["email"]
        user = User.objects.filter(email=email).first()

        if user is None:
            return None

        token = secrets.token_urlsafe(32)
        return PasswordReset.objects.create(
            email=email,
            token=token,
            expires_at=timezone.now() + timedelta(minutes=15)
        )
```

```python
# backend/accounts/views_auth.py
from django.core.mail import send_mail
from .serializers_auth import ForgotPasswordSerializer


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset = serializer.creat_reset_token()

        if reset is not None:
            send_mail(
                subject="Reset Password WorkTracker",
                message=f"Use this token to reset password: {reset.token}",
                from_email=None,
                recipient_list=[reset.email],
            )

        return Response(
            {"detail": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )
```

`secrets.token_urlsafe(32)` — dùng module `secrets` (thiết kế riêng cho
mục đích bảo mật) để sinh token không đoán được, không dùng `uuid4()`
(không phải thiết kế cho mục đích này, dù cũng dùng số ngẫu nhiên).

## 3 lỗi thật đã gặp ở bước này

### Lỗi 1 — `urls_auth.py`: `.as_View()` viết hoa chữ "V"

```python
ForgotPasswordView.as_View()   # SAI — Python phân biệt hoa/thường
```

Method đúng tên là `as_view()` (chữ thường toàn bộ). Sai hoa/thường ném
`AttributeError` ngay khi Django nạp `urls_auth.py` — làm sập **toàn bộ** app
`accounts`, kể cả Login/Logout đang chạy tốt cũng bị kéo theo, giống lỗi
`SyntaxError` đã gặp ở Giai đoạn 2. (Lỗi này tự sửa được trước khi tôi kịp
review, không lộ ra trong test thật.)

### Lỗi 2 — `views_auth.py`: thiếu tiền tố `f` trước chuỗi chứa token

```python
message="Use this token to reset password: {reset.token}",   # SAI
```

Thiếu chữ `f` trước dấu `"` đầu — đây là **lỗi âm thầm nguy hiểm nhất**
trong bước này. Chuỗi không có `f` thì `{reset.token}` không được thay
bằng giá trị thật, giữ nguyên y chữ `{reset.token}` trong nội dung email.
API vẫn trả 200 OK bình thường — **không có dòng lỗi nào báo cho bạn
biết** — nhưng người dùng (hoặc terminal dev) sẽ thấy đúng y văn bản
`{reset.token}`, không bao giờ có token thật để dùng tiếp ở Bước 3.

```python
message=f"Use this token to reset password: {reset.token}",   # ĐÚNG
```

Phát hiện được nhờ đọc kỹ log console sau khi test — thấy token thật in ra
đúng dạng chuỗi ngẫu nhiên (`8Mg63gLHB0GRV3-9Ydt6LD4LhvvFPxNWCqe6WBhEsSk`),
không phải chữ `{reset.token}` — đây là cách duy nhất phát hiện lỗi loại
này: đọc output thật, không chỉ tin "API trả 200 là xong".

### Lỗi 3 — `urls_auth.py`: thiếu dấu phẩy cuối `urlpatterns`

Lỗi nhỏ, không crash (Python list cho phép thiếu dấu phẩy cuối nếu chỉ
còn 1 dòng sau nó là `]`) — chỉ là thói quen nên giữ để dễ thêm dòng mới
sau này không quên thêm phẩy.

## Kết quả test (xem chi tiết đầy đủ ở file 04)

```text
POST /api/auth/forgot-password/ với email tồn tại → 200, console in đúng token thật
POST /api/auth/forgot-password/ với email KHÔNG tồn tại → vẫn 200, cùng message
```
