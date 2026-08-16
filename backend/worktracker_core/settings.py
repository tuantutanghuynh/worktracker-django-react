# ┌─────────────────────────────────────────────────────────────────────┐
# │  SHARED FILE — File cấu hình trung tâm, MỌI branch đều đụng         │
# │                                                                      │
# │  ĐIỂM CONFLICT KHI MERGE:                                            │
# │  1. INSTALLED_APPS → Long thêm 'reports', Tú thêm 'timesheets'      │
# │     → Uncomment từng app sau khi merge từng nhánh                    │
# │  2. DEFAULT_AUTHENTICATION_CLASSES → Tú có WorkTrackerJWTAuth        │
# │     → Đổi sau khi merge Tú (xem TODO bên dưới)                      │
# │  3. SIMPLE_JWT → Kiểm tra Long/Tú có chỉnh ACCESS_TOKEN_LIFETIME ?   │
# │  4. Redis DB allocation → Đã chuẩn hóa (DB0-3), giữ nguyên          │
# │  5. Django version → Team dùng 6.0.6, mình dùng 5.2.15              │
# │     → Cần họp nhóm để thống nhất trước khi nâng cấp                 │
# └─────────────────────────────────────────────────────────────────────┘
import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-worktracker-default-dev-key-change-in-production",
)
DEBUG = os.environ.get("DEBUG", "True").lower() in ["true", "1", "t"]
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split(",")



INSTALLED_APPS = [
    'daphne',                              # ASGI server — PHẢI đặt TRƯỚC staticfiles
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # --- THƯ VIỆN ---
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'simple_history',
    'corsheaders',
    'drf_spectacular',
    'django_celery_results',
    'channels',
    # --- APP DỰ ÁN ---
    'accounts',
    'projects',
    'tasks',
    'timesheets',
    'system',
    'reports',
    'chat',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'worktracker_core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates",],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'worktracker_core.wsgi.application'
ASGI_APPLICATION = 'worktracker_core.asgi.application'

# ── DATABASE ──────────────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     os.environ.get('DB_NAME'),
        'USER':     os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST':     os.environ.get('DB_HOST'),
        'PORT':     os.environ.get('DB_PORT'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── LOCALISATION ──────────────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True
USE_TZ = True

# ── STATIC & MEDIA ────────────────────────────────────────────────────────────

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

AUTH_USER_MODEL = 'accounts.CustomUser'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.WorkTrackerJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'CHECK_REVOKE_TOKEN': True,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'WorkTracker API',
    'DESCRIPTION': 'Tài liệu API chính thức cho hệ thống WorkTracker (Admin / Manager / Employee).',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SECURITY': [{'bearerAuth': []}],
    'COMPONENTS': {
        'securitySchemes': {
            'bearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
        }
    },
}


# Dev: in email ra console thay vì gửi thật. Đổi sang SMTP khi deploy production.
# ── EMAIL ─────────────────────────────────────────────────────────────────────

EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.smtp.EmailBackend' if os.environ.get('EMAIL_HOST_USER') else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ['true', '1', 't']
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER or 'no-reply@worktracker.com')


# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',   # Vite dev server
]

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# Redis & Cache Configuration
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{REDIS_HOST}:{REDIS_PORT}/2?protocol=2",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    },
    "blacklist": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{REDIS_HOST}:{REDIS_PORT}/1?protocol=2", 
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# ============================================================
# DJANGO CHANNELS — Channel Layer dùng Redis DB=4
# Phân tách khỏi Cache (DB=1) và Celery (DB=2, 3)
# ============================================================
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(REDIS_HOST, REDIS_PORT)],
            "prefix": "worktracker",
            "capacity": 1500,
            "expiry": 60,
        },
    },
}

WORK_DAYS_PER_WEEK = int(os.environ.get("WORK_DAYS_PER_WEEK", 6))
DAILY_WORKING_HOURS = int(os.environ.get("DAILY_WORKING_HOURS", 8))


# ── CELERY ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL        = f'redis://{REDIS_HOST}:{REDIS_PORT}/2'
CELERY_RESULT_BACKEND    = 'django-db'
CELERY_CACHE_BACKEND     = 'django-cache'
CELERY_ACCEPT_CONTENT    = ['json']
CELERY_TASK_SERIALIZER   = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE          = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True


