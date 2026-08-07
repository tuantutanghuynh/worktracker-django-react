# 07 — Profile API Giai đoạn 3: upload avatar, Pillow, 6 test case

Nối tiếp [06](06-profile-api-media-va-thong-tin-ca-nhan.md). `avatar_url`
trong model `EmployeeProfile` là `CharField` (chuỗi đường dẫn), **không
phải** `ImageField` thật của Django — nghĩa là Django không tự quản lý lưu
file/validate ảnh, phải tự viết tay toàn bộ.

## Quyết định thiết kế cần hỏi trước khi code

1. **Xác thực file thật là ảnh, không chỉ tin đuôi file** — client có thể
   đổi tên `virus.exe` thành `avatar.jpg`, hoặc giả `Content-Type`, cả 2
   cách đều dễ giả mạo. Cách an toàn: cài `Pillow` (**chưa có** trong
   `requirements.txt`), dùng DRF `serializers.ImageField()` — field này tự
   gọi Pillow mở thử file để xác nhận đúng là ảnh hợp lệ. Người học chọn
   **có** cài Pillow (không chọn phương án chỉ tin đuôi file/Content-Type).
2. **Giới hạn dung lượng** — 2MB, tự viết `validate_avatar()`.
3. **Tên file lưu trên đĩa** — không dùng tên gốc client gửi (dễ trùng/ký
   tự lạ) — tự sinh UUID + giữ đúng đuôi file gốc.

## Code

```python
# accounts/serializers_employee.py (thêm)
class AvatarUploadSerializer(serializers.Serializer):
    avatar = serializers.ImageField()

    def validate_avatar(self, value):
        max_size = 2 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("Avatar file must be 2MB or smaller.")
        return value
```

```python
# accounts/views_employee.py (thêm)
class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def patch(self, request):
        profile = get_object_or_404(EmployeeProfile, user=request.user)

        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        avatar = serializer.validated_data["avatar"]

        extension = Path(avatar.name).suffix
        filename = f"avatars/{uuid.uuid4().hex}{extension}"
        saved_path = default_storage.save(filename, avatar)

        profile.avatar_url = default_storage.url(saved_path)
        profile.save(update_fields=["avatar_url"])

        return Response({"avatar_url": profile.avatar_url}, status=status.HTTP_200_OK)
```

`parser_classes = [MultiPartParser]` bắt buộc — mặc định DRF chỉ hiểu JSON,
`multipart/form-data` (browser dùng khi upload file) cần parser riêng.
Route: `PATCH /api/auth/me/profile/avatar/` (thêm vào `accounts/urls_employee.py`).

## Verify — test thật bằng ảnh thật + file giả (không chỉ happy path)

Tạo ảnh test bằng chính Pillow (`Image.new(...).save(...)`) thay vì file
tĩnh có sẵn — kiểm chứng được cả pipeline từ tạo ảnh tới upload tới lưu đĩa.

| # | Test | Kỳ vọng | Kết quả |
|---|------|---------|:---:|
| 1 | Không gửi file | `400` "No file was submitted." | ✅ |
| 2 | Ảnh hợp lệ (PNG 10x10, 76 bytes) | `200`, lưu đúng `media/avatars/<uuid>.png` | ✅ |
| 3 | `avatar_url` persist trong `GET /me/profile/` | Đúng, bền vững | ✅ |
| 4 | File phục vụ qua `/media/avatars/...` | `200`, tải lại đúng 76 bytes | ✅ |
| 5 | File giả (`/dev/urandom`, đuôi `.png`, không phải ảnh thật) | `400` "not an image or a corrupted image" — Pillow chặn đúng | ✅ |
| 6 | Ảnh **thật** nhưng 12MB (resolution 2000x2000, `compress_level=0`) | `400` "must be 2MB or smaller" — validate size hoạt động độc lập với validate nội dung | ✅ |

Case 5 và 6 xác nhận **2 lớp validate riêng biệt** đều hoạt động: Pillow
(nội dung có phải ảnh thật không) chạy **trước** `validate_avatar` (kích
thước) trong pipeline của DRF — file giả bị chặn ở lớp Pillow trước khi
kịp tới bước kiểm tra dung lượng.

Dọn file test tạm (`/tmp/*.png`, file avatar test trong `media/avatars/`)
sau khi verify xong — không để lại rác trong repo.

Commit: `38da4d2` — "Add avatar upload for employees, validated with
Pillow and capped at 2MB."
