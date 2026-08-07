# Executive Code Annotation: `backend/worktracker_core/settings.py`

**Package / Module:** `backend.worktracker_core.settings` · App Config Central

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Cấu Hình (System Configuration Diagram)

```
                       ┌─────────────────────────────────────────┐
                       │           .env File (Bí mật)            │
                       └──────────────────┬──────────────────────┘
                                          │ load_dotenv()
                                          ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                        backend/worktracker_core/settings.py                    │
 └──────┬─────────────┬─────────────┬─────────────┬─────────────┬────────────┬─────┘
        │             │             │             │             │            │
        ▼             ▼             ▼             ▼             ▼            ▼
┌──────────────┐┌───────────┐┌─────────────┐┌───────────┐┌────────────┐┌───────────┐
│ INSTALLED    ││MIDDLEWARE ││  DATABASES  ││  SIMPLE   ││   CACHES   ││   REDIS   │
│   APPS       ││ (Security,││ (PostgreSQL)││   JWT     ││  (Redis)   ││ Blacklist │
│ (Auth, Core, ││   CORS,   ││worktracker_ ││ Access:   ││    DB 2    ││   DB 1    │
│ Accounts...) ││ Auth...)  ││     db      ││  15 phút  ││is_active   ││Logout token│
└──────────────┘└───────────┘└─────────────┘└───────────┘└────────────┘└───────────┘
```

> **Vì sao tách Redis thành 2 DB riêng biệt (DB 1 cho Blacklist, DB 2 cho `CACHES`)?**
> - **DB 1 (Blacklist JWT):** Dùng để lưu danh sách đen các Token đã logout/vứt bỏ. Cần lưu riêng để không bị lệnh xóa sạch cache (`flushdb`) của ứng dụng xóa nhầm, tránh việc token đã bị vô hiệu hóa lại trôi nổi dùng lại được.
> - **DB 2 (User `is_active` Cache):** Dùng làm bộ nhớ đệm siêu tốc cho thông tin tài khoản người dùng (`is_active`). Mỗi request gửi tới không cần đập thẳng vào database PostgreSQL để truy vấn lại trạng thái user, giảm tải 80-90% truy vấn DB (đạt tiêu chí hiệu năng NFR-04).

> **Vì sao dùng `AUTH_USER_MODEL = 'accounts.CustomUser'` ngay từ đầu thay vì User mặc định của Django?**
> Bảng `User` mặc định của Django rất hạn chế (chỉ có username, email, first_name, last_name). Trong ứng dụng quản lý công việc/chấm công real-world, user cần phân quyền RBAC đa cấp (`Role`), gắn với `Department` (Phòng ban), `EmployeeProfile` (Hồ sơ nhân viên). Khai báo `CustomUser` ngay từ đầu giúp tránh việc sau này phải migrate DB lại từ đầu vô cùng phức tạp và dễ mất dữ liệu.

> **Vì sao `ROTATE_REFRESH_TOKENS = True` đi kèm `BLACKLIST_AFTER_ROTATION = True`?**
> Đây là cơ chế bảo mật JWT tiêu chuẩn cao: Mỗi khi người dùng lấy Token mới bằng Refresh Token, Refresh Token cũ sẽ bị "thu hồi & vô hiệu hóa" ngay lập tức (Blacklisted) và phát ra 1 cặp Refresh Token hoàn toàn mới. Nếu kẻ gian chộp được Refresh Token cũ đã bị lộ, hệ thống sẽ phát hiện Token đó đã nằm trong danh sách đen và chặn ngay lập tức.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nguồn Gốc Đường Dẫn & Nạp Biến Môi Trường (Imports & Environment Setup)

```python
import os
# "import" = mượn công cụ có sẵn từ thư viện chuẩn của Python.
# "os" (Operating System) = bộ công cụ làm việc với hệ điều hành (đọc biến môi trường, đường dẫn...).

from pathlib import Path
# "from pathlib import Path" = chỉ mượn đúng lớp `Path` từ thư viện `pathlib`.
# `Path` giúp thao tác với đường dẫn thư mục/file theo phong cách hướng đối tượng hiện đại (dùng dấu `/`),
# thay vì cộng chuỗi thủ công dễ bị lỗi trên các HĐH khác nhau (Windows dùng `\`, Mac/Linux dùng `/`).

from dotenv import load_dotenv
# "from dotenv import load_dotenv" = mượn hàm `load_dotenv` từ gói `python-dotenv`.
# Hàm này có nhiệm vụ quét file ẩn `.env` và nạp các biến mật (như mật khẩu DB, secret key) vào biến môi trường hệ thống.

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
# "BASE_DIR" = tên biến viết hoa toàn bộ thể hiện đây là một HẰNG SỐ (Constant) định vị gốc dự án.
# "__file__" = biến có sẵn của Python chứa đường dẫn tới chính file hiện tại (`settings.py`).
# ".resolve()" = quy đổi thành đường dẫn tuyệt đối chuẩn xác (xóa bỏ các dấu `..` hay đường dẫn tắt).
# ".parent.parent" = lùi lại 2 cấp thư mục:
#   `settings.py` -> nằm trong `worktracker_core` (.parent lần 1) -> lùi ra `backend` (.parent lần 2).
# Ví von: `BASE_DIR` chính là "tọa độ tâm nhà" (gốc thư mục `backend/`), từ đây muốn chỉ tới bất kỳ file nào chỉ cần dùng `BASE_DIR / 'tên_file'`.

load_dotenv(BASE_DIR / '.env')
# "BASE_DIR / '.env'" = dùng toán tử `/` của `Path` để nối đường dẫn gốc tới file `.env`.
# "load_dotenv(...)" = thực thi nạp toàn bộ các cấu hình nhạy cảm từ file `.env` vào bộ nhớ.
```

---

### 2. Cấu Hình Bảo Mật Ban Đầu (Security & Core Constants)

```python
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-tpqpqakq54&(_ti#z=myx3u$k34l)0!0uk#07x#(=*f^19+)3d'
# "SECRET_KEY" = "mã khóa bí mật gốc" của ứng dụng.
# Dùng để ký tên điện tử vào Session ID, Password Reset Token, CSRF token...
# Ví von: Đây là "con dấu đỏ" của công ty. Ai có con dấu này đều có thể giả mạo chữ ký của hệ thống.
# Lưu ý: Chuỗi này ở môi trường Dev, khi lên Production bắt buộc phải đưa vào file `.env`.

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True
# "DEBUG = True" = bật chế độ sửa lỗi dành cho lập trình viên.
# Khi có lỗi code, Django sẽ hiện trang web báo lỗi chi tiết (Stack Trace, biến số).
# Trên Production phải đổi thành `False`, nếu không kẻ trộm sẽ thấy hết cấu trúc code và thông tin máy chủ khi app bị lỗi.

ALLOWED_HOSTS = []
# "ALLOWED_HOSTS" = danh sách các tên miền / địa chỉ IP được phép truy cập vào server backend này.
# Để rỗng `[]` khi `DEBUG = True` nghĩa là cho phép `localhost` / `127.0.0.1`.
# Trên Production sẽ điền tên miền thật (VD: `['api.worktracker.com']`) để chặn các đợt tấn công giả mạo Host header.
```

---

### 3. Khai Báo Các Module & Ứng Dụng (Application Definition - `INSTALLED_APPS`)

```python
# Application definition

INSTALLED_APPS = [
# "INSTALLED_APPS = [...]" = một danh sách (List) chứa tên các gói tính năng được kích hoạt trong ứng dụng.
# Cú pháp dấu ngoặc vuông `[...]` đại diện cho một danh sách ordered trong Python.

    'django.contrib.admin',        # Trang quản trị sẵn có của Django (Admin Dashboard)
    'django.contrib.auth',         # Hệ thống xác thực người dùng gốc của Django
    'django.contrib.contenttypes', # Hệ thống quản lý kiểu dữ liệu động (Generic Relations)
    'django.contrib.sessions',     # Quản lý phiên làm việc người dùng (Session)
    'django.contrib.messages',     # Hệ thống gửi thông báo ngắn (Flash messages)
    'django.contrib.staticfiles',  # Quản lý file tĩnh (CSS, JS, Hình ảnh)

    # --- CÁC THƯ VIỆN LÕI ĐÃ CÀI QUA PIP ---
    'rest_framework',              # Django REST Framework (DRF) — bộ công cụ biến Django thành RESTful API
    'rest_framework_simplejwt',    # Gói hỗ trợ xác thực bằng JSON Web Token (JWT)
    'simple_history',              # Tự động ghi lại lịch sử thay đổi của các dòng dữ liệu trong DB
    'corsheaders',                 # Thư viện xử lý chia sẻ tài nguyên giữa các tên miền (CORS)
    'drf_spectacular',             # Tự động soi code và tạo tài liệu API OpenAPI v3 (Swagger UI)

    # --- CÁC APP CỦA DỰ ÁN WORK-TRACKER ---
    'accounts',    # App quản lý tài khoản, phân quyền RBAC (Role, Permission), sơ đồ phòng ban (Department)
    'projects',    # App quản lý Dự án (Job) và Khách hàng (Client)
    'tasks',       # App quản lý Nhiệm vụ, công việc giao cho nhân viên (Task)
    'timesheets',  # App core chấm công, ghi nhận giờ làm (LogWork), khóa kỳ chấm công (TimeLock)
    'system',      # App hệ thống: nhật ký vết (AuditLog), thông báo (Notification)
    'reports',     # App xuất báo cáo tổng hợp, thống kê năng suất (PDF, Excel)

    # BLACKLIST of Simple JWT: manages whether an old refresh token can still be used after rotation
    'rest_framework_simplejwt.token_blacklist',
    # Module quản lý danh sách đen Refresh Token đã hết hạn / bị hủy của SimpleJWT.
]
# "]" = đóng danh sách các ứng dụng được cài đặt.
```

---

### 4. Lớp Đệm Xử Lý Request (Middleware Pipeline)

```python
MIDDLEWARE = [
# "MIDDLEWARE" = chuỗi các lớp "trạm kiểm soát" mà mỗi HTTP Request đi từ bên ngoài vào PHẢI đi qua lần lượt,
# và khi HTTP Response đi ra cũng đi qua theo chiều ngược lại.
# Ví von: Như chuỗi cổng an ninh sân bay — soát vé, soi an ninh, kiểm tra hộ chiếu.

    'django.middleware.security.SecurityMiddleware',
    # Trạm 1: Gia cố an ninh cơ bản (XSS filter, SSL redirect...).

    'django.contrib.sessions.middleware.SessionMiddleware',
    # Trạm 2: Quản lý session của người dùng qua cookie.

    'corsheaders.middleware.CorsMiddleware', # <-- BẮT BUỘC THÊM DÒNG NÀY VÀO ĐÂY
    # Trạm 3: Kiểm tra quyền CORS — cho phép ứng dụng Frontend (React/Vite chạy ở port 5173)
    # được phép gọi API tới Backend (Django chạy ở port 8000). Phải đứng TRƯỚC CommonMiddleware.

    'django.middleware.common.CommonMiddleware',
    # Trạm 4: Xử lý các đường dẫn URL (tự thêm dấu `/` ở cuối URL nếu thiếu).

    'django.middleware.csrf.CsrfViewMiddleware',
    # Trạm 5: Bảo vệ chống tấn công giả mạo yêu cầu từ trang web khác (Cross-Site Request Forgery).

    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # Trạm 6: Nạp thông tin người dùng (`request.user`) vào request dựa trên session/token.

    'django.contrib.messages.middleware.MessageMiddleware',
    # Trạm 7: Xử lý hiển thị thông tin nhắn tạm thời.

    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Trạm 8: Chặn trang web bị chèn vào thẻ `<iframe>` trên trang khác để chống lừa bấm nhầm (Clickjacking).
]
```

---

### 5. Cấu Hình Routing, Templates & WSGI

```python
ROOT_URLCONF = 'worktracker_core.urls'
# "ROOT_URLCONF" = chỉ định "bản đồ tuyến đường URL gốc" của hệ thống nằm tại file `worktracker_core/urls.py`.

TEMPLATES = [
# "TEMPLATES" = cấu hình công cụ vẽ trang web (HTML render engine).
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True, # Tự động tìm thư mục `templates` nằm bên trong từng app
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
# "WSGI_APPLICATION" = cổng giao tiếp tiêu chuẩn giữa Web Server (Nginx, Gunicorn) và ứng dụng Python Django.
```

---

### 6. Cấu Hình Cơ Sở Dữ Liệu PostgreSQL (Database Layer)

```python
# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
# "DATABASES" = một Dictionary (Từ điển `{...}`) khai báo thông tin kết nối Cơ sở dữ liệu.
    'default': {
    # 'default' = cấu hình CSDL mặc định của dự án.
        'ENGINE': 'django.db.backends.postgresql',
        # 'ENGINE' = khai báo loại CSDL sử dụng là PostgreSQL — hệ quản trị CSDL quan hệ mạnh mẽ, chuẩn công nghiệp.

        'NAME': os.environ.get('DB_NAME', 'worktracker_db'),
        # 'NAME' = tên của CSDL trong PostgreSQL.
        # "os.environ.get('DB_NAME', 'worktracker_db')" = ưu tiên lấy tên DB từ biến môi trường `DB_NAME`.
        # Nếu trong `.env` không có, dùng giá trị mặc định là `'worktracker_db'`.

        'USER': os.environ.get('DB_USER', 'postgres'),
        # 'USER' = tên tài khoản đăng nhập CSDL (mặc định `'postgres'`).

        'PASSWORD': os.environ.get('DB_PASSWORD'),
        # 'PASSWORD' = mật khẩu kết nối CSDL (lấy từ `.env` để không bị lộ mật khẩu khi đẩy code lên Git).

        'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
        # 'HOST' = địa chỉ máy chủ CSDL (mặc định `'127.0.0.1'` — chạy ngay trên máy local).

        'PORT': os.environ.get('DB_PORT', '5432'),
        # 'PORT' = cổng kết nối của PostgreSQL (mặc định cổng `5432`).
    }
}
```

---

### 7. Kiểm Tra Mật Khẩu & Múi Giờ (Password Validators & I18n)

```python
# Password validation
AUTH_PASSWORD_VALIDATORS = [
# Bộ 4 quy tắc kiểm định độ mạnh mật khẩu khi user đăng ký / đổi mật khẩu:
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
        # Quy tắc 1: Mật khẩu không được quá giống với tên user, email hay thông tin cá nhân.
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        # Quy tắc 2: Mật khẩu phải đạt độ dài tối thiểu (mặc định 8 ký tự).
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
        # Quy tắc 3: Mật khẩu không nằm trong danh sách các mật khẩu phổ biến dễ đoán (VD: "123456", "password").
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
        # Quy tắc 4: Mật khẩu không được chứa toàn là chữ số.
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
# Ngôn ngữ hiển thị mặc định của hệ thống (Tiếng Anh Mỹ).

TIME_ZONE = 'Asia/Ho_Chi_Minh'
# "TIME_ZONE" = Múi giờ chính thức của hệ thống — thiết lập về múi giờ Việt Nam (UTC+7).
# Rất quan trọng trong app Chấm công (Timesheet): đảm bảo tính đúng ngày/giờ nhân viên bấm LogWork.

USE_I18N = True   # Bật tính năng đa ngôn ngữ (Internationalization)
USE_TZ = True     # Lưu trữ thời gian trong CSDL dưới dạng UTC và tự động đổi sang TIME_ZONE khi hiển thị
```

---

### 8. Đổi Model User Tùy Biến & DRF Global Settings

```python
# CHỈ ĐỊNH SỬ DỤNG BẢNG USER TÙY BIẾN THAY VÌ MẶC ĐỊNH CỦA DJANGO
AUTH_USER_MODEL = 'accounts.CustomUser'
# "AUTH_USER_MODEL" = báo cho Django biết: "Đừng dùng bảng User mặc định nữa!
# Hãy dùng model CustomUser trong app `accounts` làm đại diện cho tài khoản người dùng toàn hệ thống."

# JWT auth via WorkTrackerJWTAuthentication (blacklist + is_active cache).
# All endpoints require a valid token by default unless explicitly overridden.
REST_FRAMEWORK = {
# "REST_FRAMEWORK" = Cấu hình toàn cục cho tất cả các API được viết bằng Django REST Framework:

    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.WorkTrackerJWTAuthentication",
    ),
    # Lớp xác thực mặc định: Dùng class `WorkTrackerJWTAuthentication` tự viết.
    # Lớp này kiểm tra JWT Token gửi lên trong header `Authorization: Bearer <token>`,
    # đồng thời kiểm tra token có nằm trong Redis Blacklist hay không & dùng Redis Cache kiểm tra `is_active`.

    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    # Quyền truy cập mặc định: MỌI API trong hệ thống mặc định đều BẮT BUỘC phải đăng nhập (IsAuthenticated),
    # ngoại trừ các API công khai (như Login, Quên mật khẩu) có khai báo đè `permission_classes = []`.

    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Dùng drf-spectacular để tự động phân tích code và tạo OpenAPI schema.
}
```

---

### 9. Cấu Hình Swagger UI / Documentation

```python
SPECTACULAR_SETTINGS = {
# Cấu hình thông tin hiển thị trên trang tài liệu Swagger UI (OpenAPI v3):
    "TITLE": "WorkTracker API",
    # Tiêu đề tài liệu API.
    "DESCRIPTION": "Tài liệu API chính thức cho hệ thống WorkTracker (Manager, Employee, Admin).",
    # Mô tả ngắn về hệ thống API.
    "VERSION": "1.0.0",
    # Phiên bản API.
    "SERVE_INCLUDE_SCHEMA": False,
}
```

---

### 10. Cấu Hình Thời Gian Sống Token JWT (`SIMPLE_JWT`)

```python
from datetime import timedelta
# "from datetime import timedelta" = mượn lớp `timedelta` để biểu diễn khoảng thời gian (phút, giờ, ngày).

# Short-lived access token (15 min) limits exposure if leaked.
# Refresh token rotates on every use — the old one is blacklisted immediately.
SIMPLE_JWT = {
# "SIMPLE_JWT" = Cấu hình chi tiết cho chiến lược quản lý Token JWT:

    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    # "ACCESS_TOKEN_LIFETIME" = Thời gian sống của Access Token là 15 PHÚT.
    # Access Token giống như "tấm vé xem phim / thẻ đeo ngực tạm thời" — dùng để đính kèm vào mỗi request API.
    # Vì thời gian sống ngắn (15p), nếu lỡ bị kẻ gian đánh cắp thì sau 15p vé cũng tự hủy, giảm thiểu rủi ro.

    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    # "REFRESH_TOKEN_LIFETIME" = Thời gian sống của Refresh Token là 7 NGÀY.
    # Refresh Token giống như "chìa khóa gốc" cất trong két sắt — dùng để đổi lấy Access Token mới mà không cần gõ lại password.

    "ROTATE_REFRESH_TOKENS": True,
    # "ROTATE_REFRESH_TOKENS = True" = Xoay vòng Refresh Token.
    # Mỗi khi dùng Refresh Token cũ để đổi lấy Access Token mới, hệ thống cấp luôn một Refresh Token MỚI tinh.

    "BLACKLIST_AFTER_ROTATION": True,
    # "BLACKLIST_AFTER_ROTATION = True" = Đưa Refresh Token CŨ vào danh sách đen (Blacklist) ngay lập tức,
    # đảm bảo Refresh Token cũ không thể tái sử dụng lần thứ 2.
}
```

---

### 11. Email Backend & Cấu Hình Redis Blacklist

```python
# Dev only: prints emails to console instead of sending. Switch to SMTP for production.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# "EMAIL_BACKEND" = Ở môi trường Dev, email gửi đi (như email reset password) sẽ in thẳng ra màn hình Console/Terminal
# chứ không gửi mail thật, giúp lập trình viên test nhanh tính năng mà không cần cấu hình SMTP server.

DEFAULT_FROM_EMAIL = 'no-reply@worktracker.com'
# Email đại diện hệ thống gửi tới người dùng.

# db=1: JWT blacklist after logout — uses redis_client directly, not Django's cache framework.
REDIS_HOST = "127.0.0.1"       # Địa chỉ IP máy chủ Redis (Localhost)
REDIS_PORT = 6379              # Cổng mặc định của dịch vụ Redis (6379)
REDIS_BLACKLIST_DB = 1         # Chọn cơ sở dữ liệu số 1 (DB 1) trong Redis chuyên dùng cho Blacklist Logout
```

---

### 12. Cấu Hình Cache Hệ Thống (Redis Cache DB 2)

```python
# db=2: is_active cache to avoid a DB hit on every request (NFR-04). Swap backend in one line if needed.
CACHES = {
# "CACHES" = Cấu hình bộ nhớ đệm (Cache) chính thức của Django:
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        # Sử dụng RedisCache backend chính thức tích hợp sẵn trong Django.

        "LOCATION": f"redis://{REDIS_HOST}:{REDIS_PORT}/2",
        # "f-string" (f"...") = cú pháp nhét giá trị biến vào chuỗi.
        # "redis://127.0.0.1:6379/2" = Kết nối tới Redis DB số 2.
        # DB 2 dùng để lưu tạm trạng thái `is_active` của User.
        # Mỗi khi request gửi tới, Django kiểm tra user active từ Redis DB 2 chỉ tốn < 1ms,
        # thay vì phải query PostgreSQL tốn 15-30ms, giúp hệ thống đạt chuẩn NFR-04.
    }
}
```

---

### 13. Cấu Hình CORS (Cross-Origin Resource Sharing)

```python
# Allows the Vite dev server to call the API. Add the production domain before deploying.
CORS_ALLOWED_ORIGINS = [
# "CORS_ALLOWED_ORIGINS" = Danh sách các địa chỉ Web Frontend được phép gửi request tới Backend này.
    "http://localhost:5173",
    # Cho phép máy chủ Frontend Vite (React) chạy ở cổng 5173 trên máy local gọi API tới Backend.
    # Nếu một trang web từ domain lạ (VD: `http://attacker.com`) cố tình gọi API, trình duyệt sẽ chặn lại ngay.
]
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Thành phần Cấu hình | Tham số / Giá trị chính | Ý nghĩa Nghiệp vụ & Kỹ thuật |
|-------------------|------------------------|-----------------------------|
| **Custom User Model** | `AUTH_USER_MODEL = 'accounts.CustomUser'` | Thay thế model mặc định để mở rộng phân quyền RBAC và quản lý nhân sự |
| **Cơ sở dữ liệu** | `DATABASES` (PostgreSQL) | Lưu trữ dữ liệu chính (User, Job, Task, LogWork, Department, AuditLog) |
| **Bảo mật API (JWT)** | `ACCESS_TOKEN_LIFETIME = 15m`<br>`REFRESH_TOKEN_LIFETIME = 7d` | Token sống ngắn an toàn, Refresh Token xoay vòng & đưa vào Blacklist |
| **Bảo mật Logout (Redis DB 1)** | `REDIS_BLACKLIST_DB = 1` | Lưu trữ token đã vô hiệu hóa khi Logout độc lập với bộ nhớ Cache |
| **Hiệu năng High-Speed (Redis DB 2)** | `CACHES` (Redis DB 2) | Cache thông tin `is_active` của user, đáp ứng tiêu chí NFR-04 |
| **Phân quyền mặc định** | `DEFAULT_PERMISSION_CLASSES = IsAuthenticated` | Khóa an toàn 100% endpoint, bắt buộc login trừ khi mở công khai |
| **Tài liệu API động** | `drf_spectacular` | Tự động sinh tài liệu API Swagger UI chính xác cho Frontend tiêu thụ |
| **Giao tiếp Frontend** | `CORS_ALLOWED_ORIGINS = ['http://localhost:5173']` | Mở đường kết nối an toàn cho ứng dụng React Vite Dev Server |
