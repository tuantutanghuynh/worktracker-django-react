from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

# File cấu hình URL chính của toàn dự án.
urlpatterns = [
    path("admin/", admin.site.urls),

    # --- CỔNG XÁC THỰC ---
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair_v1"),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh_v1"),

    # --- KHU VỰC CỦA MANAGER ---
    path("api/manager/", include("projects.manager.urls_manager")),
    path("api/manager/", include("tasks.manager.urls_manager")),
    path("api/manager/", include("timesheets.manager.urls_manager")),
    path("api/manager/", include("reports.manager.urls_manager")),
    path("api/manager/", include("accounts.manager.urls_manager")),
    path("api/manager/", include("system.manager.urls_manager")),

    # --- KHU VỰC CỦA ADMIN (Minh Anh) ---
    path("api/projects/", include("projects.urls")),
    path("api/accounts/", include("accounts.urls")),
    path("api/system/", include("system.urls")),

    # ---- Swagger API Docs ----
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

# Serve file media trong môi trường dev
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)