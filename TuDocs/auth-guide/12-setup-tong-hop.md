# 12 — Setup tổng hợp: Cấu hình & lệnh cài đặt (Giai đoạn 1-4)

## 1. Cài đặt hệ thống (ngoài Python)

### Trên Mac

```bash
# PostgreSQL 
brew install postgresql@16
brew services start postgresql@16

# Redis 
brew install redis
brew services start redis
redis-cli ping   # xác nhận: phải trả về PONG
```

### Trên Windows

**PostgreSQL**: tải installer chính thức tại
[postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
(EDB installer), hoặc dùng `winget`:

```powershell
winget install -e --id PostgreSQL.PostgreSQL
```

Installer tự đăng ký Postgres làm Windows Service và tự khởi động — không
cần lệnh `brew services start` tương đương. Nếu cần khởi động/dừng tay:

```powershell
net start postgresql-x64-16
net stop postgresql-x64-16
```

(Tên service có thể khác tuỳ phiên bản — xem trong `services.msc`.)

**Redis**: Redis **không hỗ trợ chính thức native trên Windows** từ nhiều
năm nay. 2 cách phổ biến nhất:

1. **WSL2 (khuyên dùng)** — cài Ubuntu qua WSL2, rồi cài Redis như trên Linux:

   ```bash
   wsl --install   # nếu chưa có WSL2 (chạy trong PowerShell, cần khởi động lại máy)
   # Sau khi vào Ubuntu (WSL):
   sudo apt update
   sudo apt install redis-server
   sudo service redis-server start
   redis-cli ping   # PONG
   ```

   Django chạy trên Windows vẫn kết nối được tới Redis trong WSL qua
   `127.0.0.1` (WSL2 forward port tự động).

2. **Memurai** — bản Redis-compatible build riêng cho Windows, chạy như
   Windows Service bình thường, không cần WSL:
   [memurai.com](https://www.memurai.com/) (có bản free cho dev).

```powershell
redis-cli ping   # PONG (dùng redis-cli đi kèm WSL hoặc Memurai)
```

## 2. Cài đặt gói Python

### Trên Mac

```bash
cd backend
source .venv/bin/activate
```

### Trên Windows

```powershell
cd backend
.venv\Scripts\activate
```

Nếu dùng PowerShell và gặp lỗi "running scripts is disabled on this
system" (chính sách `Execution Policy` mặc định chặn script `.ps1`), chạy
1 lần (chỉ cho user hiện tại, không cần quyền Admin):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

rồi chạy lại `.venv\Scripts\Activate.ps1`. Nếu dùng Command Prompt (`cmd.exe`,
không phải PowerShell), dùng `.venv\Scripts\activate.bat` thay vì cú pháp trên.

Toàn bộ gói cần thiết đã có trong `requirements.txt`:

```text
asgiref==3.11.1
Django==6.0.6
django-cors-headers==4.9.0
django-simple-history==3.11.0
djangorestframework==3.17.1
djangorestframework_simplejwt==5.5.1
psycopg2-binary==2.9.12
PyJWT==2.13.0
python-dotenv==1.2.2
redis==8.0.0
sqlparse==0.5.5
```

```bash
pip install -r requirements.txt
```

(Nếu cài thủ công từng gói mới, dùng đúng lệnh tương ứng):

```bash
pip install djangorestframework djangorestframework-simplejwt django-simple-history django-cors-headers psycopg2-binary   # nền tảng ban đầu
pip install redis            # Giai đoạn 2
pip install python-dotenv    # Giai đoạn 2 (đọc biến môi trường từ .env)
```

## 3. File `.env` (KHÔNG commit — đã có trong `.gitignore`)

Tạo file `backend/.env`:

```env
DB_PASSWORD=<password Postgres thật của bạn>
```

(Tuỳ chọn, nếu dùng Gmail SMTP thật thay cho console backend — xem mục 6):

```env
EMAIL_HOST_USER=<email gmail>
EMAIL_HOST_PASSWORD=<App Password 16 ký tự, không dùng password Gmail thật>
```

## 4. `INSTALLED_APPS` — `backend/worktracker_core/settings.py`

```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'simple_history',
    'corsheaders',

    'accounts',
    'projects',
    'tasks',
    'timesheets',
    'system',

    'rest_framework_simplejwt.token_blacklist',  # Giai đoạn 1
]
```

## 5. Đọc biến môi trường — đầu file `settings.py`

```python
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

BASE_DIR = Path(__file__).resolve().parent.parent
```

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'worktracker_db',
        'USER': 'postgres',
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': '127.0.0.1',
        'PORT': '5432',
    }
}
```

## 6. Cấu hình REST_FRAMEWORK + SIMPLE_JWT (Giai đoạn 1-2) — cuối `settings.py`

```python
AUTH_USER_MODEL = 'accounts.CustomUser'

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.BlacklistAwareJWTAuthentication",  # custom, kiểm tra blacklist (Giai đoạn 2)
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
```

## 7. Cấu hình Email (Giai đoạn 4)

**Dev (console — in email ra terminal, mặc định đang dùng):**

```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'no-reply@worktracker.com'
```

**Khi cần demo thật bằng Gmail SMTP (tuỳ chọn, chưa áp dụng):**

```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
```

## 8. Cấu hình Redis cho JWT Blacklist (Giai đoạn 2)

```python
REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6379
REDIS_BLACKLIST_DB = 1  # Database index for JWT token blacklisting
```

## 9. Lệnh migrate — chạy đúng thứ tự khi setup máy mới

```bash
python manage.py makemigrations
python manage.py migrate
```

Migration cần chạy qua (đã có sẵn trong code, tự chạy theo thứ tự khi gọi
`migrate`):

```text
accounts.0001_initial                              — model gốc (Role, Permission, CustomUser, ...)
rest_framework_simplejwt.token_blacklist.*          — Giai đoạn 1
accounts.0002_seed_roles_permissions                — Giai đoạn 3 (data migration: seed roles/permissions)
accounts.0003_add_employee_view_permission          — Giai đoạn 3 (data migration: thêm 1 permission)
```

## 10. Lệnh chạy & kiểm tra nhanh môi trường

```bash
python manage.py check                 # xác nhận không lỗi cấu hình/cú pháp
python manage.py runserver 8000        # chạy dev server
```

### Trên Mac/Linux — truyền script nhiều dòng trực tiếp qua `-c`

```bash
# Xác nhận Redis kết nối được từ Django
python manage.py shell -c "
from accounts.redis_client import redis_client
redis_client.set('test_key', 'hello')
print(redis_client.get('test_key'))
redis_client.delete('test_key')
"

# Xác nhận seed RBAC đã đúng
python manage.py shell -c "
from accounts.models import Role, Permission, RolePermission
print('Roles:', Role.objects.count())          # kỳ vọng: 3
print('Permissions:', Permission.objects.count())  # kỳ vọng: 16
print('RolePermissions:', RolePermission.objects.count())  # kỳ vọng: 16
"
```

### Trên Windows — `-c` nhiều dòng không hoạt động tốt trong cmd/PowerShell

Cú pháp chuỗi nhiều dòng trong dấu `"..."` ở trên là đặc thù shell
Mac/Linux (bash/zsh) — `cmd.exe` và PowerShell không hiểu xuống dòng giữa
dấu nháy giống vậy. Cách thay thế đơn giản nhất trên Windows: mở
`manage.py shell` ở dạng tương tác, rồi dán từng dòng vào:

```powershell
python manage.py shell
```

```python
>>> from accounts.redis_client import redis_client
>>> redis_client.set('test_key', 'hello')
>>> print(redis_client.get('test_key'))
>>> redis_client.delete('test_key')
```

Gõ `exit()` để thoát shell sau khi xong. Tương tự cho lệnh kiểm tra seed
RBAC — dán từng dòng vào shell tương tác thay vì dùng `-c`.

## 11. Routes hiện có — `backend/accounts/urls.py`

```text
POST /api/auth/login/
POST /api/auth/logout/
POST /api/auth/refresh/
POST /api/auth/user/<id>/disable/
GET  /api/auth/team/employees/
POST /api/auth/forgot-password/
POST /api/auth/reset-password/
```

## 12. Tài khoản test đang có (chỉ trên máy dev, không có trong git)

```text
admin@worktracker.com      — role ADMIN
manager@worktracker.com    — role MANAGER, quản lý phòng "Phong Ky Thuat"
employee@worktracker.com   — role EMPLOYEE, thuộc phòng "Phong Ky Thuat"
```

Tạo lại nếu cần (xem chi tiết script ở `giai-doan-3-log/04-testing-va-ket-qua.md`).
