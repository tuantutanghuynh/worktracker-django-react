# 01 — Mental Model: Authentication vs Authorization

## Hai câu hỏi, không phải một

Người mới hay nhập nhằng hai khái niệm này. Tách bạch ra:

| | Authentication (Xác thực) | Authorization (Phân quyền) |
|---|---|---|
| Câu hỏi | "Bạn là ai?" | "Bạn có quyền làm việc này không?" |
| Diễn ra khi | Lúc đăng nhập | Mỗi lần gọi API |
| Kết quả | Có/không xác minh được danh tính | Có/không được phép thực hiện hành động |
| Trong dự án này | Email + Password → JWT | Role + Permission → cho/chặn request |

Nếu bạn chỉ làm xong "đăng nhập thành công, có token" mà chưa làm
Authorization, hệ thống của bạn giống như **có cổng bảo vệ kiểm tra CMND ở
cửa, nhưng vào trong thì ai muốn vào phòng nào cũng được**. Đây chính là lý do
tài liệu yêu cầu (`WorkTracker_Authentication_Guide.md`, mục 7-8) nhấn mạnh:
"Không chỉ dùng Role. Phải dùng Role + Permission" và "Data Isolation —
Không tin tưởng Frontend".

## Vì sao chọn JWT mà không phải Session truyền thống?

Mô hình Session cũ (Django mặc định khi mới `startproject`):

```text
Browser --cookie sessionid--> Django
                                 ↓
                         Tra bảng django_session trong DB
                                 ↓
                         Biết user là ai
```

Vấn đề: mỗi request đều phải tra DB để biết "session này thuộc ai". Khi có
nhiều server (scale ngang), session phải đồng bộ giữa các server — phức tạp.

Mô hình JWT (Stateless):

```text
Browser --Authorization: Bearer <token>--> Django
                                              ↓
                                 Giải mã token bằng SECRET_KEY
                                              ↓
                                 Biết user là ai (không cần tra DB)
```

JWT tự chứa thông tin (user_id, email, role) đã được ký số. Django **không
cần hỏi database** "ai đang gọi request này" — chỉ cần giải mã chữ ký. Đây là
lý do kiến trúc tổng thể trong tài liệu auth ghi:

```text
React Vite → JWT Access Token (15m) → Django DRF → SimpleJWT → RBAC Permission Engine → MySQL/Postgres
```

JWT phù hợp với React SPA (Single Page App) gọi API thuần túy, không dùng
server-render HTML — đúng kiến trúc dự án của bạn (React Vite tách biệt khỏi
Django).

## Đánh đổi của JWT (phải hiểu để giải thích được, không phải chỉ áp dụng)

Stateless là lợi thế, nhưng kéo theo một vấn đề: **khi đã phát hành token,
Django không thể "thu hồi" nó giữa đường** — vì không tra DB nữa. Nếu nhân
viên A bị Admin khóa tài khoản lúc 10:00, nhưng token của họ còn hạn tới
10:15, họ vẫn dùng được token đó gọi API trong 15 phút còn lại trừ khi có cơ
chế blacklist.

Đây chính là vấn đề mà mục "Account Locking / Offboarding" trong
`all worktracker features-fix.docx` đề cập: *"Khi Admin bấm Khóa tài khoản...
đồng thời gọi một hàm để xóa Refresh Token của người này... ép họ văng khỏi hệ
thống lập tức."* Cách giải quyết cụ thể nằm ở file
[02-jwt-and-tokens.md](02-jwt-and-tokens.md) (Redis blacklist).

## Khái niệm sẽ dùng xuyên suốt series

- **Access Token**: token sống ngắn (15 phút), gửi kèm mỗi request để xác thực.
- **Refresh Token**: token sống dài (7 ngày), dùng để xin Access Token mới khi Access Token hết hạn — không cần đăng nhập lại.
- **RBAC (Role-Based Access Control)**: mô hình phân quyền theo vai trò, nhưng ở đây mở rộng thành Role + Permission (chi tiết ở file 04).
- **Data Isolation**: dù có quyền xem "Task", Manager A không được thấy Task của Manager B — phải lọc theo `request.user` ở tầng query, không phải tầng UI.

## Câu hỏi tự kiểm tra (trước khi qua file 02)

1. Nếu Admin xóa Role "EMPLOYEE" khỏi hệ thống, điều gì xảy ra với các JWT đã
   phát hành cho nhân viên có role đó? (Gợi ý: JWT đã ký rồi, không tự cập
   nhật theo DB).
2. Vì sao payload JWT nên chứa `role` thay vì để Django tra `role` từ DB mỗi
   lần? Đánh đổi là gì nếu role thay đổi giữa lúc token còn hạn?

Trả lời được 2 câu này nghĩa là bạn đã nắm mental model — chuyển sang file 02.
