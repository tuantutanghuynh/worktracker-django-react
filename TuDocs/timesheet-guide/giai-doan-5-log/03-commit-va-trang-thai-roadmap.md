# 03 — Commit thật đã tạo + đối chiếu lại roadmap Tuần 1-4

## 5 commit đã tạo trong giai đoạn này (25-29/07/2026)

```text
7378f79 Add Employee Personal KPI: overdue task count, weekly hours, and completion rate over an optional date range.
38da4d2 Add avatar upload for employees, validated with Pillow and capped at 2MB.
9154a53 Add media file serving and a self-service profile API for employees to view/edit their name and phone number.
277246c Add Celery with a Redis broker and a retrying email task, wired into the notification service.
8351ebb Add notification list and mark-as-read API for employees.
bb37a7b Fix FR-57 (two-step GLOBAL/JOB time lock check), add FR-58 (void log work) and FR-72 (log work notification types), unify HasPermission, and wire audit logging into auth/log-work actions.
```

Mỗi commit tách theo đúng 1 đơn vị công việc hoàn chỉnh (đã code + test
xong), không gộp nhiều tính năng không liên quan vào 1 commit. Tất cả đứng
tên tác giả thật (Tăng Huỳnh Tuấn Tú, theo `git config` cục bộ), message
tiếng Anh 1-2 câu, **không có** trailer `Co-Authored-By` hay bất kỳ nhắc
tới AI nào — quy ước đã thống nhất và giữ nhất quán suốt cả giai đoạn.

## Đối chiếu roadmap Tuần 1-4 (project-roadmap/03-phase-tuan-tu-auth-employee.md)

| Tuần | Việc | Trạng thái |
|---|---|:---:|
| 1 | Auth core, RBAC, `must_change_password`, Frontend auth kit | ✅ |
| 2 | Notification list + mark-as-read API | ✅ |
| 2 | Celery + task email | ✅ (GĐ 1-4, xem [02](02-celery-setup.md)/[04](04-celery-giai-doan-3-4-task-that.md)) |
| 2 | Profile API (sửa info + avatar) | ✅ (3 giai đoạn, xem [06](06-profile-api-media-va-thong-tin-ca-nhan.md)/[07](07-profile-api-avatar-upload.md)) |
| 2 | `timesheets` LogWork cơ bản + Pessimistic Locking | ✅ |
| 3 | Time Lock API + Defensive layer 1 | ✅ (quyền sở hữu API đã đổi sang Đức Long sau merge team, xem `giai-doan-4-log/00-tong-quan.md`) |
| 3 | P7.3 Personal KPI | ✅ (xem [08](08-p73-personal-kpi.md)) |
| 4 | FR-72 notification types | ✅ |
| 4 | `log_audit_event` cho mọi action nhạy cảm của Tuấn Tú | ✅ (Reset/Change Password, Create/Void Log Work) |
| 4 (Frontend) | Personal Dashboard, Notification Center | ⬜ chưa bắt đầu |

**Toàn bộ hàng backend đã ✅.** Hàng duy nhất còn trống là Frontend (Tuần
1-4), và mảng Frontend Employee nói chung chưa có gì ngoài phần Auth.

## Việc còn lại, ưu tiên tiếp theo

1. **Toàn bộ Frontend Employee** — chưa có dòng code nào (Layout, My Tasks,
   Log Work form, Personal Dashboard, Notification Center) — rủi ro lớn
   nhất hiện tại vì backend đã đủ API nhưng không có gì để người dùng thật
   thao tác/demo.
2. **Báo cho Đức Long** cách chạy `celery -A worktracker_core worker` song
   song `runserver` khi dev — script đã viết sẵn ở
   [05-script-trinh-bay-duc-long-celery.md](05-script-trinh-bay-duc-long-celery.md),
   chỉ cần gửi/đọc trực tiếp cho anh ấy, chưa xác nhận đã gửi hay chưa.
3. Buffer cuối (03/08-06/08 theo roadmap) sẽ cần rà lại toàn bộ API Auth
   một lần cuối — chưa tới lúc, chỉ ghi chú để không quên.
