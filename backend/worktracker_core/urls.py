"""
URL configuration for worktracker_core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView  # <-- Thêm dòng này

urlpatterns = [
    path('admin/', admin.site.urls),

    # --- CỔNG XÁC THỰC (Dùng chung để các thành viên lấy Token test) ---
    path('api/v1/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # --- KHU VỰC CỦA MANAGER ---
    path('api/v1/manager/', include('tasks.urls_manager')),
    path('api/v1/manager/', include('timesheets.urls_manager')),
]