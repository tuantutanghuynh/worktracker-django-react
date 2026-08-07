# WorkTracker — Tóm tắt trình bày trước lớp

## 1. Vấn đề dự án giải quyết

**Bối cảnh:** Nhiều tổ chức hiện quản lý công việc bằng Excel, email, chat — rời rạc, không có luồng xử lý tập trung.

**5 vấn đề cụ thể** mà WorkTracker giải quyết:
1. Thông tin công việc phân tán nhiều nơi → khó có cái nhìn tổng quan tiến độ dự án
2. Theo dõi trạng thái task thủ công → dễ trễ deadline, không rõ trách nhiệm
3. Timesheet ghi tay → dễ nhập sai giờ, trùng lặp, sửa dữ liệu sau khi đã chốt kỳ báo cáo
4. Báo cáo phải gom dữ liệu từ nhiều nguồn → chậm, dễ sai, khó ra quyết định
5. Không có audit log → không truy vết được ai đổi deadline, khóa timesheet, sửa tài khoản...

→ **Giải pháp:** một nền tảng web tập trung quản lý công việc và chấm công (work management & time tracking), phân quyền theo 3 vai trò: **Admin – Manager – Employee**.

## 2. Chức năng chính (theo module)

| Module | Chức năng nổi bật |
|---|---|
| Auth & phân quyền | JWT có thu hồi token khi logout, khóa tài khoản tức thời, bắt buộc đổi mật khẩu lần đầu |
| Client & Job | Quản lý hồ sơ khách hàng, job có mã định danh riêng (`JOB-2026-001`), gắn manager phụ trách |
| Task & Kanban | Bảng Kanban 5 cột (`TODO → IN_PROGRESS → REVIEWING → COMPLETED/CANCELLED`), gán việc, ưu tiên, deadline, review/duyệt/từ chối, comment, đính kèm file |
| Timesheet & khóa thời gian | Ghi giờ làm (giới hạn mềm 8h/ngày, cứng 24h/ngày), Approve/Reject/Correct/Void, khóa kỳ chấm công (`TimeLock`) |
| Thông báo & cộng tác | Realtime qua WebSocket + email, lịch sử thông báo |
| Hồ sơ cá nhân | Cập nhật thông tin, avatar |
| Báo cáo & phân tích | Dashboard KPI, biểu đồ, tỷ lệ sử dụng nhân lực (Utilization Rate), xuất PDF/Excel |
| Audit log | Ghi lại hành động nhạy cảm, xem lịch sử thay đổi (diff view) |

**Ngoài phạm vi:** payroll, kế toán, HR nâng cao, app mobile, tích hợp bên thứ 3, task dependency/subtask.

## 3. Công nghệ sử dụng

- **Frontend:** React (Vite) + JavaScript ES6/JSX, Tailwind CSS v4, React Router, Zustand (state), TanStack Query (server state), React Hook Form + Zod (form/validate), TanStack Table, Recharts (chart), DnD Kit (kéo-thả Kanban), Radix UI, Sonner (toast), React Use WebSocket
- **Backend:** Django + Django REST Framework, Django Simple JWT (auth), Django Channels/Daphne (WebSocket realtime), Celery (xử lý nền/email), drf-spectacular (Swagger docs), django-simple-history (audit/version history), openpyxl + xhtml2pdf (xuất Excel/PDF)
- **Database & hạ tầng:** PostgreSQL, Redis (cache + Celery broker + Channels), SMTP email
- **Kiểm thử & công cụ:** pytest/pytest-django (109 test case), Git/GitHub, Postman/Swagger UI

## 4. Số lượng bảng dữ liệu

Chapter 1 chỉ là chương tổng quan, không liệt kê số bảng — con số dưới đây lấy trực tiếp từ `models.py` của backend.

**18 bảng nghiệp vụ chính**, chia theo 5 Django app:

- **accounts (7 bảng):** CustomUser, Role, Permission, RolePermission, PasswordReset, Department, EmployeeProfile
- **projects (2 bảng):** Client, Job
- **tasks (4 bảng):** Task, TaskFollower, TaskComment, TaskAttachment
- **timesheets (3 bảng):** TimeLock, LogWork, DailyUserTimesheet
- **system (2 bảng):** AuditLog, Notification

*(Chưa tính các bảng phụ trợ do framework tự sinh: bảng lịch sử của `django-simple-history` cho mỗi model được track, và các bảng hệ thống mặc định của Django/Celery như session, content type, celery results...)*
