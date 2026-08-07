# Executive Code Annotation: `backend/accounts/urls_auth.py`

**Package / Module:** `backend.accounts.urls_auth` · Authentication Sub-Routing Config

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm vị von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Phân Nhánh Auth URLs (Auth Endpoints Sub-Routing Diagram)

```
                               ┌──────────────────────────────────────────┐
                               │  Root Router (/api/auth/ -> urls_auth)   │
                               └────────────────────┬─────────────────────┘
                                                    │
        ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ /login/       │   │ /logout/      │   │ /refresh/     │   │/forgot-pass/  │   │/reset-pass/   │   │/change-pass/  │
│ (LoginView)   │   │ (LogoutView)  │   │ (TokenRefresh)│   │ (ForgotPass)  │   │ (ResetPass)   │   │ (ChangePass)  │
└───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘
```

> **Vì sao tách riêng `urls_auth.py` độc lập với `urls_admin.py` và `urls_manager.py` trong cùng app `accounts`?**
> Các đường dẫn trong `urls_auth.py` đại diện cho các tính năng xác thực **dùng chung cho MỌI vai trò người dùng** (Admin, Manager, Employee). Tách riêng file này giúp không gian tên đường dẫn gọn gàng, không đòi hỏi các quyền RBAC đặc thù của Admin hay Manager, đồng thời giúp việc quản lý bảo mật tại các trạm kiểm soát Gateway dễ dàng hơn.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Module Routing & Class Views

```python
from django.urls import path
# "path" là 1 HÀM (không phải class) -- gọi `path(route, view, name=...)` trả về 1 OBJECT kiểu URLPattern,
# đại diện cho "quy tắc khớp URL". Đây là hàm định tuyến hiện đại của Django (thay cho `url()`/`re_path()`
# kiểu cũ dùng regex) -- route ở đây là CHUỖI ĐƯỜNG DẪN TRẦN, không phải regex.

from rest_framework_simplejwt.views import TokenRefreshView
# "TokenRefreshView" là 1 CLASS-BASED VIEW CÓ SẴN (đã viết trọn vẹn logic) từ thư viện SimpleJWT, khác 5 view
# còn lại (LoginView, LogoutView...) là view TỰ VIẾT trong views_auth.py. Dùng thẳng class có sẵn ở đây vì
# logic "đổi refresh token lấy access token mới" là chuẩn, không cần tùy biến gì thêm cho project này.

from .views_auth import LoginView, LogoutView, ForgotPasswordView, ResetPasswordView, ChangePasswordView
# Relative import (dấu "." đầu) 5 class View TỰ VIẾT, cùng thư mục accounts/ với file này.
```

---

### 2. Danh Sách Các Đường Dẫn Auth (`urlpatterns`)

```python
# Auth routes shared by every role — no role-specific permission required
# beyond holding a valid (non-blacklisted) JWT where applicable.
urlpatterns = [
# "urlpatterns" KHÔNG PHẢI tên biến tự đặt tùy ý -- đây là TÊN BIẾN CỐ ĐỊNH mà bộ định tuyến của Django TỰ
# TÌM KIẾM trong mỗi file urls.py khi include() file này từ nơi khác (vd worktracker_core/urls.py) -- viết
# sai tên (vd "url_patterns") sẽ khiến Django không tìm thấy route nào, dù code không lỗi cú pháp.
# Giá trị gán vào là 1 LIST (dấu ngoặc vuông [...]), mỗi phần tử là 1 object URLPattern do path() trả về.

    path("login/", LoginView.as_view(), name="login"),
    # `path(route, view, name=...)` nhận 3 tham số: (1) chuỗi route KHÔNG có dấu "/" ở đầu (route này được
    # NỐI TIẾP vào sau tiền tố đã include() ở file cha, ra thành /api/auth/login/); (2) view là 1 CALLABLE.
    # `.as_view()` là CLASSMETHOD đặc biệt của Django CBV: nó KHÔNG trả về 1 instance của LoginView, mà trả
    # về 1 HÀM closure -- mỗi khi có request khớp route này, Django gọi hàm đó, và bên trong hàm đó Django
    # mới thực sự tạo 1 instance MỚI của LoginView cho request đó rồi gọi .dispatch() -> .post(). Đây là lý
    # do CBV luôn viết `.as_view()` chứ không bao giờ viết `LoginView()` hay `LoginView` trần trong urlpatterns.
    # (3) `name="login"` là 1 ĐỊNH DANH dùng để REVERSE LOOKUP URL ở nơi khác trong code (vd `reverse("login")`
    # trả lại đúng chuỗi "/api/auth/login/") thay vì phải hard-code chuỗi URL rải rác nhiều nơi.
    # URL: `/api/auth/login/` [POST] -> Đăng nhập, nhận cặp Access & Refresh Token kèm User Payload.

    path("logout/", LogoutView.as_view(), name="logout"),
    # URL: `/api/auth/logout/` [POST] -> Đăng xuất, đưa Token JWT hiện tại vào Redis Blacklist DB 1.

    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Vẫn gọi `.as_view()` y hệt view tự viết, dù TokenRefreshView đến từ thư viện ngoài (SimpleJWT) -- cơ
    # chế CBV áp dụng chung cho MỌI class kế thừa từ APIView/View, không phân biệt tự viết hay import sẵn.
    # URL: `/api/auth/refresh/` [POST] -> Cấp lại Access Token mới bằng Refresh Token (Có xoay vòng Refresh Token).

    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    # Lưu ý route dùng dấu gạch ngang "-" ("forgot-password") nhưng `name=` lại dùng dấu gạch dưới "_"
    # ("forgot_password") -- 2 chuỗi này ĐỘC LẬP với nhau: route quyết định URL thật client gọi, name chỉ là
    # định danh nội bộ trong code Python (nơi khác không thể gõ `reverse("forgot-password")` vì dấu "-" không
    # hợp lệ trong tên biến/định danh Python).
    # URL: `/api/auth/forgot-password/` [POST] -> Yêu cầu gửi email khôi phục mật khẩu.

    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    # URL: `/api/auth/reset-password/` [POST] -> Đặt lại mật khẩu bằng Token từ email.

    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    # Ở dòng NÀY thì name="change-password" lại dùng dấu gạch ngang giống route -- không nhất quán với
    # "forgot_password"/"reset_password" phía trên (đây là điểm chưa đồng bộ convention trong code thật của
    # project, không gây lỗi vì cả 2 kiểu đều là chuỗi hợp lệ cho tham số name=, nhưng đáng lưu ý khi bạn tự
    # viết route mới để giữ nhất quán).
    # URL: `/api/auth/change-password/` [POST] -> Đổi mật khẩu cá nhân dành cho user đã đăng nhập.
]
# Dấu "]" đóng list -- toàn bộ 6 path() ở trên là 6 PHẦN TỬ của cùng 1 list Python, cách nhau bằng dấu phẩy.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Đường Dẫn (Endpoint Path) | HTTP Method | Class View Phụ Trách | Ý Nghĩa Nghiệp Vụ & Quyền Hạn |
|-------------------|-------------|----------------------|-----------------------------|
| `/api/auth/login/` | `POST` | `LoginView` | Đăng nhập công khai (AllowAny), phát hành JWT & Permissions |
| `/api/auth/logout/` | `POST` | `LogoutView` | Đăng xuất (IsAuthenticated), vô hiệu hóa Token vào Redis DB 1 |
| `/api/auth/refresh/` | `POST` | `TokenRefreshView` | Cấp Access Token mới từ Refresh Token kèm xoay vòng (Rotate) |
| `/api/auth/forgot-password/` | `POST` | `ForgotPasswordView` | Yêu cầu gửi email chứa token reset password |
| `/api/auth/reset-password/` | `POST` | `ResetPasswordView` | Nhập token từ email & đổi mật khẩu mới |
| `/api/auth/change-password/` | `POST` | `ChangePasswordView` | Đổi mật khẩu cá nhân & xóa cờ ép đổi mật khẩu (`must_change_password`) |
