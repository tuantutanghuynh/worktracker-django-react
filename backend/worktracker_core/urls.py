from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

# File cấu hình URL chính của toàn dự án.
# Django đọc file này đầu tiên khi nhận một request, sau đó chuyển tiếp sang file urls.py của từng app tương ứng.
urlpatterns = [
    # Trang quản trị nội bộ Django (dành cho dev, không phải giao diện công ty).
    path('admin/', admin.site.urls),

    # --- CỔNG XÁC THỰC JWT ---
    # Dùng chung cho tất cả thành viên để lấy token đăng nhập.
    # POST /api/v1/auth/login/   → gửi email + password, nhận access token + refresh token.
    # POST /api/v1/auth/refresh/ → gửi refresh token, nhận access token mới (gia hạn phiên).
    path('api/v1/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # --- SCOPE CỦA MINH ANH (Admin) ---
    # Chuyển tiếp các request có prefix 'api/projects/' sang projects/urls.py.
    # Bao gồm: Clients (/api/projects/clients/) và Jobs (/api/projects/jobs/).
    path('api/projects/', include('projects.urls')),
    path('api/accounts/', include('accounts.urls')),
    # Chuyển tiếp các request có prefix 'api/system/' sang system/urls.py.
    # Bao gồm: AuditLogs (/api/system/audit-logs/) — chỉ đọc.
    path('api/system/', include('system.urls')),
    
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
