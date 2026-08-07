# 02 — `ChangePasswordSerializer` & `ChangePasswordView`

## Vì sao cách viết khác hẳn `LoginSerializer`/`ResetPasswordSerializer`

Ở `LoginSerializer`, `validate()` phải **tìm ra** user là ai (từ email). Ở
`ResetPasswordSerializer`, user xác định qua **token** (không cần đăng
nhập). Ở đây, user **đã biết rồi** — họ đang đăng nhập,
`request.user` đã có sẵn nhờ `BlacklistAwareJWTAuthentication`.
`validate()` chỉ cần xác nhận họ thật sự nhớ đúng password hiện tại —
không chỉ tin vì họ đang cầm token hợp lệ (phòng trường hợp ai đó dùng máy
đã đăng nhập sẵn của người khác).

Để serializer đọc được `request.user`, phải truyền
`context={"request": request}` khi tạo serializer trong View — cách
chuẩn của DRF để serializer "biết" về request hiện tại (khác với
`LoginSerializer` không cần context vì nó tự tra `request.data`, chưa có
user nào để biết trước).

## Code cuối cùng — `backend/accounts/serializers_auth.py`

```python
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user

        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError("Current password is incorrect.")

        return attrs

    def apply_new_password(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.save()
```

## Code cuối cùng — `backend/accounts/views_auth.py`

```python
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.apply_new_password()

        return Response({"detail": "Password changed successfully"}, status=status.HTTP_200_OK)
```

## Vì sao `permission_classes = [IsAuthenticated]`, không phải `[HasPermission]`

Đây là quyết định quan trọng nhất ở bước này, liên kết trực tiếp với
Bước 3 (chặn trong `HasPermission`). Nếu `ChangePasswordView` cũng dùng
`HasPermission`, nó sẽ **tự chặn chính nó** — user bị buộc đổi password
nhưng không bao giờ gọi được API đổi password để thoát ra (vòng lặp bế
tắc). Dùng `IsAuthenticated` thuần khiến view này tự động không bị chặn,
không cần viết thêm logic ngoại lệ nào (xem chi tiết ở
`03-has-permission-gate.md`).

## Route — `backend/accounts/urls_auth.py`

```python
path("change-password/", ChangePasswordView.as_view(), name="change-password"),
```

## Bug thật đã gặp: thiếu dấu `/` cuối route — 404 chỉ lộ ra khi gọi đúng chuẩn

Lần đầu viết:

```python
path("change-password", ChangePasswordView.as_view(), name="change-password")   # SAI — thiếu "/"
```

Không khớp quy ước mọi route khác trong file (`login/`, `logout/`,
`forgot-password/`...) đều có dấu `/` cuối.

### Vì sao đây không phải lỗi "vô hại", dù trông như chỉ thiếu 1 ký tự

Django có `APPEND_SLASH` (mặc định `True`) — khi nhận request thiếu `/`
cuối mà route có `/` được định nghĩa, Django **tự động redirect** sang
URL có `/`. Nhưng cơ chế này **chỉ áp dụng cho các method "an toàn"**
(GET, HEAD) — **không áp dụng cho POST**, vì redirect 1 request `POST` có
thể làm mất phần body đã gửi (một số client không gửi lại body khi theo
redirect). `ChangePasswordView` chỉ định nghĩa `post()`.

Hậu quả: nếu Frontend gọi đúng theo quy ước chung của cả dự án —
`POST /api/auth/change-password/` (có `/`, giống mọi API khác) — sẽ nhận
**404**, vì route thật đã định nghĩa lại **không có** `/`. Lỗi này nguy
hiểm vì **test bằng cách gõ đúng path thiếu `/` (khớp với route sai) vẫn
"chạy được"** — chỉ lộ ra khi ai đó (đúng quy ước) gọi có `/`.

### Cách sửa

```python
path("change-password/", ChangePasswordView.as_view(), name="change-password"),
```

### Bài học chung cho cả nhóm

Khi thêm route mới vào bất kỳ `urls_<role>.py`, luôn cuối bằng `/` —
không phải vì "đẹp", mà vì method `POST`/`PUT`/`PATCH`/`DELETE` không có
lưới an toàn tự sửa như `GET`.
