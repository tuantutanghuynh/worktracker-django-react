# 04 — Routing 2 tầng: Project → App

## Vì sao tách `accounts/urls.py` riêng, không gộp hết vào 1 file gốc

Django dùng kiến trúc routing 2 tầng: `worktracker_core/urls.py` (tầng
project) chỉ làm việc "phân luồng" — quyết định tiền tố nào (`api/auth/`)
thuộc về app nào, rồi giao toàn quyền cho `urls.py` riêng của app đó tự
định nghĩa chi tiết bên trong. Đây đúng tinh thần "mỗi app tự quản lý route
của mình", giống cách tách `Controller` riêng cho mỗi nhóm chức năng bên
Java — chỉ khác là Django bắt buộc phải có 1 file gốc "mount" tất cả lại
với nhau, vì không có cơ chế tự động quét annotation như Spring.

## Code cuối cùng — `backend/accounts/urls_auth.py`

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views_auth import LoginView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
```

`TokenRefreshView` import thẳng từ thư viện (không tự viết) — đúng lý do đã
giải thích ở file 03: refresh không cần logic tùy biến, claim được giữ
nguyên tự động qua payload.

`name="login"` — đặt tên cho route (không bắt buộc để chạy được, nhưng là
thói quen tốt): nếu cần redirect/reverse URL ở đâu đó trong Django sau này
(test, hoặc link trong email), gọi `reverse("login")` luôn ra đúng path
hiện tại dù path string đổi sau này — tránh hardcode chuỗi path rải rác
nhiều nơi, giống nguyên tắc "đặt hằng số, đừng lặp magic string".

## Code cuối cùng — `backend/worktracker_core/urls.py`

```python
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls_auth')),
]
```

`include('accounts.urls_auth')` nghĩa là: "mọi request bắt đầu bằng
`api/auth/`, giao tiếp luôn cho `accounts/urls_auth.py` tự xử lý phần còn
lại của path". (Tên file `accounts.urls` ban đầu, sau này tách thành
`urls_auth.py`/`urls_admin.py`/`urls_manager.py` theo "3 Quy tắc vàng" —
xem `project-roadmap/00-tong-quan.md`.)

## Kết quả 2 endpoint thật sự nhận được

```text
POST /api/auth/login/
POST /api/auth/refresh/
```

Đã xác nhận bằng cách in resolver của Django:

```bash
python manage.py shell -c "
from django.urls import get_resolver
for p in get_resolver().url_patterns:
    print(p)
"
```

```text
<URLResolver <URLPattern list> (admin:admin) 'admin/'>
<URLResolver <module 'accounts.urls_auth' ...> (None:None) 'api/auth/'>
```
