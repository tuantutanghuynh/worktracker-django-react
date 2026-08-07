# 01 — Sự cố cấu hình: `settings.py` chặn cả server khởi động

## Bối cảnh

Trước khi bắt tay vào code Log Work, trong working tree đã có sẵn (chưa
commit) phần scaffold app rỗng cho 2 đồng đội, theo đúng "3 Quy tắc vàng":
`audit/`, `clients/`, `jobs/` (cho Minh Anh) và `notifications/` (cho chính
mình, nhưng lúc này còn rỗng — model `Notification` thật vẫn đang nằm trong
`timesheets/models.py`).

## Lỗi phát hiện được — chạy thử `python manage.py check`

```text
ModuleNotFoundError: No module named 'notification'
```

### Nguyên nhân

`worktracker_core/settings.py` khai báo trong `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    ...
    'timesheets',
    'notification',   # ← sai: thiếu chữ "s"
    'system',
    ...
]
```

Thư mục app thật là `backend/notifications/` (có "s"), nhưng dòng khai báo
gõ nhầm thành `notification` (số ít). Đây đúng lớp lỗi đã ghi ở
`auth-guide/giai-doan-1-log/01-cau-hinh-settings.md`: Python không có
compiler kiểm tra chuỗi string ứng với tên module có thật hay không lúc gõ
code — lỗi chỉ lộ ra khi `django.setup()` thật sự chạy và cố `import_module()`
theo đúng chuỗi đó.

### Cách sửa

Sửa `'notification'` → `'notifications'` cho khớp tên thư mục thật.

## Sự cố phụ: 3 app mới chưa được đăng ký

Ngoài lỗi trên, `audit`, `clients`, `jobs` — 3 thư mục app vừa tạo bằng
`startapp` — hoàn toàn **chưa có mặt** trong `INSTALLED_APPS`. Vì migrations
của cả 3 app này lúc đó chỉ có `__init__.py` (chưa có model nào), thiếu đăng
ký không làm crash `manage.py check` ngay — nhưng sẽ chặn Minh Anh khi cô ấy
bắt đầu viết model và chạy `makemigrations` cho app của mình.

### Quyết định: đăng ký luôn cả 3, không để đó

Hỏi lại chủ dự án (Tuấn Tú) — chọn đăng ký ngay để nhánh `TuanTu` merge vào
là chạy được luôn, Minh Anh checkout ra không cần tự sửa `settings.py` (file
dùng chung, càng ít người phải sửa càng ít conflict lúc merge Chủ Nhật).

## Code cuối cùng — `backend/worktracker_core/settings.py`

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
    'notifications',
    'clients',
    'jobs',
    'audit',
    'system',

    'rest_framework_simplejwt.token_blacklist'
]
```

## Xác nhận đã sửa đúng

```bash
python manage.py check
```

```text
System check identified no issues (0 silenced).
```

## Ghi chú để sau — chưa xử lý trong Giai đoạn 1 này

Model `Client`/`Job` thật hiện vẫn đang nằm trong app `projects`
(`projects/models.py`), **không phải** trong 2 app rỗng `clients`/`jobs` vừa
tạo và đăng ký. Nghĩa là hiện tại có 2 khả năng: (1) `clients`/`jobs` là app
rỗng chờ Minh Anh tự viết model mới vào, và `projects` sẽ bị bỏ dần; hoặc
(2) đây là trùng lặp ý định cần thống nhất lại với team. Chưa xác nhận —
**cần hỏi rõ Minh Anh** trước khi cô ấy bắt đầu code, tránh vừa có
`projects.Job` vừa có `jobs.Job` cùng tồn tại gây nhầm FK.
