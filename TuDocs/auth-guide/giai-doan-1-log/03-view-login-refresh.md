# 03 — `LoginView` & tái sử dụng `TokenRefreshView`

## Vì sao `LoginView` cần `permission_classes = [AllowAny]`

Ở bước cấu hình settings, `DEFAULT_PERMISSION_CLASSES` toàn cục đã đặt là
`IsAuthenticated` — nghĩa là **mọi View không khai báo gì riêng** tự động
yêu cầu phải có token mới gọi được. Login là API duy nhất phải **public** —
đúng nghĩa đen bài toán "con gà và quả trứng": chưa đăng nhập thì chưa có
token, mà chưa có token thì sao gọi được API cần token để... đăng nhập?
Phải khai báo `AllowAny` ngay trên class `LoginView` để ghi đè default toàn
cục, chỉ áp dụng riêng cho API này.

## Vì sao View này không có `try/except` — khác biệt cách DRF xử lý exception so với Java Controller

Bên Java (theo style `KienThuc_04_ExceptionHandling` đã tham khảo), Controller
tự `catch (IllegalArgumentException e)` rồi tự gọi `showMsg()`. DRF làm việc
này **tự động** ở một lớp nằm ngoài View — gọi là *exception handler* toàn
cục: nếu serializer (hoặc bất kỳ đâu trong View) `raise` `ValidationError`,
`AuthenticationFailed`, hay `PermissionDenied`, DRF tự bắt lấy và tự convert
thành `Response` với đúng status code, không cần viết try/except thủ công.
Giống như nếu Java Spring có sẵn `@ExceptionHandler` toàn cục — Controller
chỉ cần `throw`, không cần tự `catch` ở mọi nơi.

`raise_exception=True` trong `serializer.is_valid(raise_exception=True)`
chính là chỗ "throw" đó — nếu `validate()` ở serializer ném lỗi, `is_valid()`
ném tiếp lỗi đó lên cho DRF exception handler xử lý, dòng code sau nó
(`get_tokens()`) sẽ **không bao giờ chạy tới**.

## Code cuối cùng — `backend/accounts/views_auth.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .serializers import LoginSerializer


class LoginView(APIView):
    # Ghi đè default toàn cục (IsAuthenticated) vì login phải public
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        # raise_exception=True: nếu validate() raise lỗi, DRF tự convert
        # thành Response đúng status code — dòng dưới sẽ không chạy tới
        serializer.is_valid(raise_exception=True)

        tokens = serializer.get_tokens()
        return Response(tokens, status=status.HTTP_200_OK)
```

## Refresh — không viết View riêng, tái dùng `TokenRefreshView` của SimpleJWT

SimpleJWT đã có sẵn `TokenRefreshView`, và nó **tự động giữ nguyên** 2 claim
tùy biến (`email`, `role`) đã gắn lúc Login mà không cần code thêm gì. Lý
do: JWT tự chứa dữ liệu (đã học ở `auth-guide/02-jwt-and-tokens.md`) — claim
`email`/`role` được mã hóa thẳng vào chuỗi refresh token gửi cho Frontend.
Khi Frontend gửi refresh token đó lên `/refresh/`, SimpleJWT giải mã ra,
thấy 2 claim đó đã có sẵn trong payload, và copy tiếp sang access token mới
— đúng cơ chế "copy claim từ payload tại thời điểm đọc" đã học ở file 02.

Chỉ cần import sẵn `TokenRefreshView` ở `urls_auth.py` (xem file 04), không cần
định nghĩa class mới trong `views_auth.py`.

## Việc dọn dẹp nhỏ còn sót lại

File `views.py` (sau này tách thành `views_auth.py` — xem
`project-roadmap/00-tong-quan.md` mục "3 Quy tắc vàng") ban đầu được Django tự sinh ra với nội dung mẫu
(`from django.shortcuts import render` và comment `# Create your views
here.`) — 2 dòng này **không ảnh hưởng chức năng** nhưng nên xóa khi rảnh
để code sạch, vì `render` không còn dùng tới (`LoginView` chỉ trả JSON qua
`Response`, không render HTML template nào).
