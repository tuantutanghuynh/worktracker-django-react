from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


urlpatterns = [
    path("admin/", admin.site.urls),

    # --- CỔNG XÁC THỰC ---
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # --- KHU VỰC CỦA MANAGER ---
    path("api/manager/", include("projects.urls_manager")),
    path("api/manager/", include("tasks.urls_manager")),
    path("api/manager/", include("timesheets.urls_manager")),
    path("api/manager/", include("reports.urls_manager")),
]