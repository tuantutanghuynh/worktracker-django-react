# Giai đoạn 5 — Hoàn thành toàn bộ backend Tuần 1-4: Notification, Celery, Profile API, P7.3 KPI

Bản ghi lại quá trình làm việc ngày 25-29/07/2026, nối tiếp
[giai-doan-4-log](../giai-doan-4-log/). Đây là giai đoạn khép lại **toàn bộ
phần backend** của roadmap `project-roadmap/03-phase-tuan-tu-auth-employee.md`
(Tuần 1-4): (1) hoàn thiện Notification API đã "nợ lại" từ
`giai-doan-4-log/05`, (2) dựng hạ tầng Celery trọn vẹn (4 giai đoạn), (3)
Profile Management (P6.0) — sửa thông tin cá nhân + upload avatar, và (4)
P7.3 Employee Personal KPI — mảng cuối cùng còn thiếu.

## Phạm vi đã hoàn thành

| # | Việc | Trạng thái |
|---|------|:---:|
| 1 | Commit phần code đã viết từ giai-doan-4 (FR-57/58/72, hợp nhất `HasPermission`, wire audit log) — 12 file, chưa từng commit trước đó | ✅ |
| 2 | API list + mark-as-read notification cho Employee — nợ từ `giai-doan-4-log/05`, nay đã gõ + test thật bằng curl | ✅ |
| 3 | Celery Giai đoạn 1 — cài đặt, cấu hình broker (Redis db=3) | ✅ |
| 4 | Celery Giai đoạn 2 — task "hello world" (`ping`), xác nhận worker nhận & chạy task | ✅ |
| 5 | Celery Giai đoạn 3 — task thật `send_notification_email_task` (gửi mail + retry theo NFR-20) | ✅ |
| 6 | Celery Giai đoạn 4 — tích hợp vào `enqueue_email_best_effort()`, test end-to-end qua `notify(..., channel=EMAIL_ONLY)` | ✅ |
| 7 | Profile API Giai đoạn 1-2 — setup `MEDIA_ROOT`/`MEDIA_URL`, API sửa `full_name`/`phone_number` (2 bug thật gặp phải) | ✅ |
| 8 | Profile API Giai đoạn 3 — upload avatar, validate bằng Pillow + giới hạn 2MB, 6 test case | ✅ |
| 9 | P7.3 Employee Personal KPI — 3 chỉ số (task quá hạn, giờ log tuần, tỷ lệ hoàn thành theo date range tùy chọn) | ✅ |

**Toàn bộ backend Tuần 1-4 theo roadmap đã hoàn thành.** Việc lớn còn lại
chuyển hẳn sang Frontend Employee (chưa có gì ngoài phần Auth).

## Cây file đã tạo/sửa

```text
backend/
├── system/
│   ├── serializers_employee.py   ← tạo mới: NotificationSerializer
│   ├── views_employee.py         ← tạo mới: NotificationListView, NotificationMarkReadView
│   ├── urls_employee.py          ← tạo mới: route notifications (sửa lại 1 lần vì bug route trùng)
│   ├── tasks.py                  ← tạo mới: task `ping` (test hạ tầng) + `send_notification_email_task` (task thật)
│   └── services/
│       └── notification_manager_service.py  ← sửa: bỏ comment enqueue_email_best_effort()
├── accounts/
│   ├── serializers_employee.py   ← tạo mới: EmployeeProfileSerializer, AvatarUploadSerializer, PersonalKPIQuerySerializer
│   ├── views_employee.py         ← tạo mới: ProfileView, AvatarUploadView, PersonalKPIView
│   └── urls_employee.py          ← tạo mới: route me/profile/, me/profile/avatar/, me/kpi/
├── worktracker_core/
│   ├── celery.py                 ← tạo mới: Celery app instance
│   ├── __init__.py               ← sửa: import celery_app (trước đó file rỗng)
│   ├── settings.py               ← sửa: CELERY_BROKER_URL/CELERY_RESULT_BACKEND (Redis db=3), MEDIA_ROOT/MEDIA_URL
│   └── urls.py                   ← sửa: mount system.urls_employee tại api/notifications/, accounts.urls_employee tại api/auth/, static() cho media (dev-only)
└── requirements.txt              ← sửa: thêm celery==5.6.3, pillow==12.3.0
```

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-notification-api-thuc-thi.md](01-notification-api-thuc-thi.md) | Vì sao thiết kế cuối khác đề xuất ở `giai-doan-4-log/05` (APIView thay vì GenericViewSet+Router); bug route trùng `notifications/notifications/`; 6 bước test curl thật |
| 2 | [02-celery-setup.md](02-celery-setup.md) | Giai đoạn 1-2 dựng hạ tầng Celery; 2 lỗi thật gặp phải (đặt sai tên file `task.py`, gõ code Python thẳng vào terminal); phát hiện về tính bền của message queue |
| 3 | [03-commit-va-trang-thai-roadmap.md](03-commit-va-trang-thai-roadmap.md) | 2 commit thật đã tạo; đối chiếu lại toàn bộ roadmap Tuần 1-4 xem còn thiếu gì |
| 4 | [04-celery-giai-doan-3-4-task-that.md](04-celery-giai-doan-3-4-task-that.md) | Task thật `send_notification_email_task` (chọn exception cụ thể thay vì bắt hết), tích hợp vào `enqueue_email_best_effort()`, test end-to-end qua `notify()` với log console-email thật |
| 5 | [05-script-trinh-bay-duc-long-celery.md](05-script-trinh-bay-duc-long-celery.md) | Script nói chuyện với Đức Long: cách chạy worker song song `runserver`, cách gọi `notify()` đúng `channel`, giới hạn hiện tại cần biết trước khi demo |
| 6 | [06-profile-api-media-va-thong-tin-ca-nhan.md](06-profile-api-media-va-thong-tin-ca-nhan.md) | Setup media, API sửa `full_name`/`phone_number`, 2 bug thật (gõ đè file sai app, thiếu xử lý user không có profile) |
| 7 | [07-profile-api-avatar-upload.md](07-profile-api-avatar-upload.md) | Upload avatar, quyết định dùng Pillow xác thực ảnh thật, 6 test case (kể cả file giả mạo và ảnh quá lớn) |
| 8 | [08-p73-personal-kpi.md](08-p73-personal-kpi.md) | 3 chỉ số KPI, ranh giới quan trọng giữa "Employee tự xem" và "Manager đánh giá người khác" (không làm phần Manager) |

## Nguyên tắc đáng nhớ nhất

1. **Thiết kế đề xuất trên giấy có thể đổi khi thực thi thật** — bản đề
   xuất ở `giai-doan-4-log/05` dùng `GenericViewSet`+`ListModelMixin`+
   `DefaultRouter`, nhưng khi thực thi lại chọn 2 `APIView` thuần để nhất
   quán với các view Employee khác đã có (`EmployeeLogWorkView`,
   `EmployeeVoidLogWorkView`) — không phải đề xuất sai, mà ưu tiên nhất
   quán codebase hơn "đúng chuẩn REST" trên giấy.
2. **Ghép 2 đoạn route tưởng chừng độc lập có thể tạo ra trùng lặp** —
   prefix ở `urls.py` cha + path trong file con cùng chứa chữ
   "notifications" → sinh route `api/notifications/notifications/`. Luôn
   nhìn URL cuối cùng ráp lại, không chỉ nhìn từng mảnh riêng.
3. **Message queue bền theo thiết kế** — task gửi vào Redis qua `.delay()`
   không mất dù chưa có worker nào tiêu thụ ngay lúc đó; worker khởi động
   sau vẫn lấy lại đúng task cũ từ hàng đợi. Hiểu đúng điều này giúp không
   hoảng khi "gọi task mà không thấy gì xảy ra" — có thể do worker chưa
   chạy, không phải do task bị mất.
4. **Không gõ code Python trực tiếp vào terminal (shell)** — terminal chỉ
   chạy lệnh; code Python luôn phải nằm trong file, được 1 tiến trình
   (Django, Celery, `manage.py shell`) đọc và thực thi.
5. **2 app khác nhau có file trùng tên là cái bẫy dễ gõ nhầm** — `system/serializers_employee.py`
   và `accounts/serializers_employee.py` đều tồn tại hợp lệ, độc lập nhau
   — gõ nhầm vào file có sẵn của app khác đè mất code cũ (đã xảy ra thật,
   xem [06](06-profile-api-media-va-thong-tin-ca-nhan.md)). Luôn xác nhận
   đường dẫn đầy đủ, tên file một mình không đủ để biết đúng chỗ.
6. **"Tự xem của mình" và "xem của người khác" luôn là 2 tính năng khác
   nhau, dù nghe giống nhau** — P7.3 (Employee tự xem KPI) và "Manager
   đánh giá nhân viên" khác nhau ở mô hình phân quyền (`IsAuthenticated` +
   `request.user` vs `HasPermission` + data scoping), và có thể khác cả
   ranh giới trách nhiệm trong team (xem [08](08-p73-personal-kpi.md)) —
   đừng gộp chung chỉ vì cùng dùng lại được phần lớn logic tính toán.
7. **Trả `None` thay vì `0` khi không đủ dữ liệu để tính** — `completion_rate`
   khi chưa có Task nào trong khoảng thời gian trả `null`, không trả `0`,
   để phân biệt "chưa có dữ liệu" với "có dữ liệu nhưng tỷ lệ là 0%".
