from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),

    # ── AUTH (login / logout / forgot-password / reset-password) ──────────────
    # TODO sau merge với Tú: xóa 2 dòng JWT thô bên dưới và thay bằng:
    # path('api/auth/', include('accounts.urls_auth')),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ── ADMIN — accounts: users / roles / permissions / departments ───────────
    path('api/auth/', include('accounts.urls')),

    # ── ADMIN — projects: clients / jobs ─────────────────────────────────────
    path('api/admin/', include('projects.urls')),

    # ── ADMIN — system: audit-logs / dashboard / reports ─────────────────────
    path('api/admin/', include('system.urls')),

    # ── MANAGER scope — uncomment sau khi merge branch LongNguyen ────────────
    # path('api/auth/',    include('accounts.urls_manager')),
    # path('api/manager/', include('projects.manager.urls_manager')),
    # path('api/manager/', include('tasks.manager.urls_manager')),
    # path('api/manager/', include('reports.manager.urls_manager')),
    # path('api/manager/', include('accounts.manager.urls_manager')),
    # path('api/manager/', include('system.manager.urls_manager')),

    # ── EMPLOYEE + TIMESHEETS — uncomment sau khi merge branch TuanTu ─────────
    # path('api/auth/',        include('accounts.urls_employee')),
    # path('api/timesheets/',  include('timesheets.manager.urls_manager')),
    # path('api/timesheets/',  include('timesheets.urls_employee')),
    # path('api/notifications/', include('system.urls_employee')),

    # ── SCHEMA ────────────────────────────────────────────────────────────────
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/',   SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/',  SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
