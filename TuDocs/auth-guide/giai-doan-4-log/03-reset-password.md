# 03 — `ResetPasswordSerializer` & `ResetPasswordView`

## Vì sao 3 message lỗi khác nhau ở đây, không gộp chung như lúc Login

Ở Login, gộp chung message "Email hoặc mật khẩu không đúng" là để chống
**user enumeration** (không lộ email nào tồn tại). Ở đây, `token` là chuỗi
ngẫu nhiên dài 32 byte — không ai "dò" được token hợp lệ bằng cách thử
nhiều lần, nên không có rủi ro enumeration tương tự. Phân biệt rõ 3 lỗi
(`không tồn tại` / `đã dùng` / `đã hết hạn`) giúp Frontend hiển thị đúng
thông báo cho từng tình huống — đây là quyết định thiết kế có chủ đích,
không phải thiếu sót bảo mật.

## Code cuối cùng

```python
class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Cùng pattern đã dùng ở LoginSerializer: khai báo trước để
        # attribute luôn tồn tại, tránh AttributeError nếu gọi sai thứ tự
        self.reset_record = None

    def validate(self, attrs):
        reset = PasswordReset.objects.filter(token=attrs["token"]).first()

        if reset is None:
            raise serializers.ValidationError("Invalid Token")

        if reset.is_used:
            raise serializers.ValidationError("This reset link has already been used.")

        if reset.expires_at < timezone.now():
            raise serializers.ValidationError("This reset link has expired.")

        self.reset_record = reset
        return attrs

    def apply_new_password(self):
        # Guard clause: cùng lý do đã học ở get_tokens() của LoginSerializer
        if self.reset_record is None:
            raise RuntimeError(
                "apply_new_password() called before successful validation. "
                "Ensure that validate() is called and passed before calling this method."
            )

        user = User.objects.filter(email=self.reset_record.email).first()
        user.set_password(self.validated_data["new_password"])
        user.save()

        self.reset_record.is_used = True
        self.reset_record.save()
```

```python
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()

        return Response({"detail": "Password has been reset successfully"}, status=status.HTTP_200_OK)
```

## 2 lỗi crash thật đã gặp khi gõ lại đoạn `__init__`/`apply_new_password`

### Lỗi 1 — tên tham số `kargs`, nhưng gọi `kwargs`

```python
def __init__(self, *args, **kargs):     # tham số nhận vào tên là "kargs"
    super().__init__(*args, **kwargs)    # nhưng dòng dưới lại dùng "kwargs"
```

`kwargs` không tồn tại trong scope của hàm (tham số thật tên `kargs`,
thiếu chữ "w"). Ngay khi `ResetPasswordView` gọi
`ResetPasswordSerializer(data=request.data)`, Python ném
`NameError: name 'kwargs' is not defined`. Cùng họ lỗi gõ thiếu chữ đã gặp
nhiều lần (`form`/`from`, `tji`/`jti`) — lần này ở tên tham số hàm.

### Lỗi 2 — `self.validation_data` thay vì `self.validated_data`

```python
user.set_password(self.validation_data["new_password"])   # SAI
```

DRF Serializer có attribute chuẩn tên là `validated_data` (chữ "d" ở
"validate**d**"), không phải `validation_data`. Đây là biến thể mới của
lớp lỗi "sai tên attribute" — nhưng đặc biệt đáng nhớ vì xảy ra ở **chính
attribute lõi của framework** (không phải attribute tự đặt tên như
`self.user` hay `self.reset_record`), nên dễ chủ quan không soát kỹ.

```python
user.set_password(self.validated_data["new_password"])   # ĐÚNG
```

Cả 2 lỗi đều **crash ngay khi chạy thử** (1 lỗi ở lúc tạo serializer, 1 lỗi
ở lúc gọi `apply_new_password()`) — dễ phát hiện qua traceback, không phải
loại lỗi âm thầm như lỗi thiếu `f`-string ở file 02.

## Route

```python
path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
```
