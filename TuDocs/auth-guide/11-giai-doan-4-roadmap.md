# 11 — Roadmap chi tiết Giai đoạn 4: Forgot Password

Tiếp nối Giai đoạn 3 (RBAC). Giai đoạn này độc lập với JWT/Redis/Permission
đã làm — chỉ dùng lại model `PasswordReset` đã có sẵn từ đầu trong
`accounts/models.py` (chưa cần migration mới).

## Mục tiêu cuối Giai đoạn 4

Người dùng quên mật khẩu có thể tự khôi phục qua email, không cần Admin
reset tay — đúng luồng đã phân tích kỹ ở `auth-guide/05-forgot-password-and-account-lifecycle.md`.

## Nhắc lại luồng đã thiết kế (từ file 05, áp dụng thật ở đây)

```text
[1] User nhập email vào form "Quên mật khẩu"
[2] FE: POST /api/auth/forgot-password/  { email }
[3] BE: Tạo token ngẫu nhiên an toàn (secrets.token_urlsafe())
[4] BE: Lưu vào PasswordReset: email, token, expires_at (now + 15 phút), is_used=False
[5] BE: Gửi email chứa link reset (dev: in ra console, không cần SMTP thật)
[6] BE: LUÔN trả 200 OK, dù email tồn tại hay không (chống user enumeration)
[7] User bấm link → FE hiện form nhập mật khẩu mới
[8] FE: POST /api/auth/reset-password/  { token, new_password }
[9] BE: kiểm tra token tồn tại? chưa dùng? chưa hết hạn?
[10] BE: cập nhật password, đánh dấu is_used=True
```

## Việc cần làm, chia theo 3 phần

### Phần 1 — `ForgotPasswordView`: sinh token, gửi email

```python
# accounts/serializers.py (thêm class mới, không sửa LoginSerializer)
import secrets
from django.utils import timezone
from datetime import timedelta

from .models import PasswordReset


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save_reset_token(self):
        email = self.validated_data["email"]
        user = User.objects.filter(email=email).first()

        # Vẫn tạo token ngay cả khi không tìm thấy user — tránh nhánh
        # rẽ khác nhau giữa "email tồn tại" và "không tồn tại" có thể
        # bị đo thời gian phản hồi để suy luận (cùng lý do anti-enumeration)
        if user is None:
            return

        token = secrets.token_urlsafe(32)
        PasswordReset.objects.create(
            email=email,
            token=token,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        # gửi email ở Phần 2
```

Vì sao dùng `secrets.token_urlsafe(32)`, không dùng `uuid.uuid4()`: module
`secrets` của Python được thiết kế riêng cho mục đích bảo mật (cryptographically
secure), trong khi `uuid4` dùng `os.urandom` gián tiếp nhưng không phải mục
đích thiết kế chính — `secrets` là lựa chọn chuẩn khi cần token "không đoán
được" (tương tự lý do dùng `PreparedStatement` thay vì tự nối chuỗi SQL bên
Java JavaFX bạn đã quen).

### Phần 2 — Cấu hình gửi email (dev dùng console backend)

Thêm vào `settings.py`:

```python
# Môi trường dev: email được IN RA TERMINAL, không gửi thật — đủ để test
# luồng mà không cần tài khoản SMTP
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "no-reply@worktracker.local"
```

Gửi email trong `View` (không phải trong `Serializer` — gửi email là tác
vụ I/O, nên đặt ở lớp gọi serializer, dễ test serializer độc lập mà không
cần mock việc gửi mail):

```python
from django.core.mail import send_mail


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]  # giống LoginView — public, chưa đăng nhập cũng gọi được

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset = serializer.save_reset_token()

        if reset is not None:
            send_mail(
                subject="Đặt lại mật khẩu WorkTracker",
                message=f"Dùng token này để đặt lại mật khẩu: {reset.token}",
                from_email=None,  # dùng DEFAULT_FROM_EMAIL
                recipient_list=[reset.email],
            )

        # LUÔN 200, dù email tồn tại hay không
        return Response(
            {"detail": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )
```

Lưu ý: `save_reset_token()` cần trả về object `PasswordReset` vừa tạo (hoặc
`None`) để `View` biết có cần gửi mail hay không — sửa lại Phần 1 cho khớp
(`return PasswordReset.objects.create(...)`).

### Phần 3 — `ResetPasswordView`: verify token, đổi password

```python
class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        reset = PasswordReset.objects.filter(token=attrs["token"]).first()

        if reset is None:
            raise serializers.ValidationError("Invalid or expired token.")

        if reset.is_used:
            raise serializers.ValidationError("This reset link has already been used.")

        if reset.expires_at < timezone.now():
            raise serializers.ValidationError("This reset link has expired.")

        self.reset_record = reset
        return attrs

    def apply_new_password(self):
        user = User.objects.get(email=self.reset_record.email)
        user.set_password(self.validated_data["new_password"])
        user.save()

        self.reset_record.is_used = True
        self.reset_record.save()
```

Vì sao gộp 3 điều kiện (`không tồn tại` / `đã dùng` / `đã hết hạn`) thành 3
message khác nhau, không dùng chung 1 message như lúc Login: ở Login, gộp
chung message là để **chống user enumeration** (không lộ email nào tồn
tại). Ở đây, token là chuỗi ngẫu nhiên dài 32 byte — không ai "dò" được
token hợp lệ bằng cách thử nhiều lần, nên không có rủi ro enumeration
tương tự. Phân biệt rõ 3 lỗi giúp Frontend hiển thị đúng thông báo (token
sai khác hẳn ý nghĩa với token đã dùng rồi hoặc đã hết hạn).

`apply_new_password()` cần `try/except` không? Không cần — `User.objects.get(email=...)`
ở đây an toàn vì `self.reset_record` chỉ tồn tại sau khi `validate()` đã
xác nhận `reset.email` hợp lệ (cùng email lúc tạo token, lúc đó đã check
`user is None` ở Phần 1) — nhưng vẫn nên cân nhắc dùng `.filter().first()`
để nhất quán style, phòng trường hợp hiếm (user bị xóa giữa lúc gửi email
và lúc reset).

## Routes — `accounts/urls.py`

```python
path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
```

## Test dự kiến (làm khi bắt tay vào code thật)

```text
[1] POST /forgot-password/ với email tồn tại → 200, terminal in ra email chứa token
[2] POST /forgot-password/ với email KHÔNG tồn tại → vẫn 200 (không lộ thông tin)
[3] POST /reset-password/ với token từ bước 1 + password mới → 200
[4] POST /reset-password/ LẠI với CÙNG token đó → lỗi "already been used"
[5] Login bằng password MỚI → 200, thành công
[6] Login bằng password CŨ → 401, không còn dùng được
```

## Việc KHÔNG làm trong Giai đoạn 4 (để khỏi lan phạm vi)

- Chưa thêm `must_change_password` (thuộc Giai đoạn 5).
- Chưa làm rate limit cho `forgot-password/` (chống spam gửi mail) — thuộc
  nhóm "Nâng cao", optional.
