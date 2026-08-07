# 06 — Bảo mật thường gặp & Audit Log

## Lỗi bảo mật phổ biến khi mới làm Auth (để tránh, không phải để nhớ thuộc lòng)

### 1. Lưu JWT ở đâu trên Frontend?

Hai lựa chọn phổ biến, mỗi lựa chọn có rủi ro riêng:

| Nơi lưu | Rủi ro chính | Ghi chú |
|---|---|---|
| `localStorage` | Dễ bị đánh cắp qua **XSS** (JavaScript độc hại đọc được `localStorage`) | Đơn giản, dễ dùng với SPA — dự án này dùng Zustand (in-memory) kết hợp localStorage để persist qua lần reload |
| `httpOnly Cookie` | Cần phòng **CSRF** (cookie tự động gửi kèm mọi request tới domain) | An toàn hơn trước XSS vì JavaScript không đọc được cookie httpOnly |

Tài liệu yêu cầu của dự án chọn lưu token qua Zustand (tức là JS có thể truy
cập) — đây là lựa chọn đơn giản, hợp lý cho dự án nội bộ doanh nghiệp, nhưng
đồng nghĩa với việc **chống XSS ở phía Frontend (không render HTML không rõ
nguồn gốc, escape output...) trở thành lớp bảo vệ quan trọng** mà bạn cần
nhắc team khi trình bày — đây không phải lỗ hổng của riêng phần auth, mà là
trách nhiệm chung của cả Frontend.

### 2. CORS — vì sao cấu hình sai sẽ vô tình mở cửa cho mọi domain

Vì React (chạy ở `localhost:5173` hoặc domain riêng) và Django (domain khác)
là 2 origin khác nhau, cần CORS để browser cho phép gọi API chéo domain.
Project đã cài `corsheaders` (thấy trong `requirements.txt` đã cập nhật) —
điểm cần lưu ý khi cấu hình: **không bao giờ dùng
`CORS_ALLOW_ALL_ORIGINS = True` trong production** — phải khai báo rõ domain
Frontend được phép gọi (`CORS_ALLOWED_ORIGINS = ["https://worktracker.app"]`).
Cho phép tất cả origin nghĩa là **bất kỳ website nào trên Internet** cũng có
thể gọi API của bạn kèm cookie/token của user nếu họ đang đăng nhập — mở toang
cửa cho tấn công CSRF/credential theft.

### 3. Rate Limiting cho Login

Nếu API login không giới hạn số lần thử, kẻ tấn công có thể **brute-force**
(thử hàng nghìn password cho 1 email) bằng script tự động. Tài liệu xếp đây
vào nhóm "Nâng cao" nhưng nên hiểu nguyên lý: giới hạn số lần thử sai trong
một khoảng thời gian (ví dụ tối đa 5 lần / 15 phút / theo IP hoặc theo email).

### 4. Account Locking (liên quan tới Rate Limiting nhưng khác phạm vi)

```sql
failed_login_count
locked_until
```

```text
Sai password 5 lần liên tiếp
       ↓
Khóa tài khoản 15 phút (locked_until = now + 15p)
       ↓
Trong 15 phút đó, dù gõ đúng password cũng từ chối login,
trả thông báo "Tài khoản tạm khóa do nhập sai nhiều lần, thử lại sau"
```

Khác với Rate Limiting (chặn theo IP/tần suất chung), Account Locking chặn
theo **từng tài khoản cụ thể** — bảo vệ tài khoản đó dù kẻ tấn công đổi IP
liên tục.

## Audit Log — ghi lại "ai làm gì, lúc nào"

Tài liệu yêu cầu cụ thể các event cần ghi (mục 10 của
`WorkTracker_Authentication_Guide.md`):

- `LOGIN_SUCCESS`
- `LOGIN_FAILED`
- `LOGOUT`
- `PASSWORD_CHANGED`
- `ACCOUNT_LOCKED`

Liên hệ tới bảng `audit_logs` (thuộc app `system`, không phải `accounts`,
nhưng app `accounts` là nơi **sinh ra** các event cần ghi log này). Theo
thiết kế DB (`DATABASE_WORKTRACKER`), mỗi dòng audit log có cấu trúc:

```text
user_id     — ai thực hiện (NULL nếu user bị xóa, vẫn giữ log)
action      — 'LOGIN_FAILED', 'PASSWORD_CHANGED', ...
table_name  — bảng bị ảnh hưởng
record_id   — dòng nào bị ảnh hưởng
old_values / new_values — JSON, dữ liệu trước/sau khi đổi
ip_address  — IP của request
created_at  — thời điểm
```

Câu hỏi quan trọng cần thảo luận với người phụ trách app `system` (Minh Anh):
**ai gọi hàm ghi audit log — code trong `accounts` tự gọi, hay có Middleware
chung tự động bắt mọi request POST/PUT/DELETE?** Tài liệu gợi ý cả 2 cách:
*"Sử dụng thư viện django-simple-history hoặc tự viết một Middleware..."*
`django-simple-history` (đã có trong `INSTALLED_APPS`) tự động lưu lịch sử
thay đổi của model nó theo dõi — phù hợp cho audit "dữ liệu gì đã đổi", nhưng
**không tự ghi được các event không gắn với model thay đổi** như
`LOGIN_FAILED` (không có bản ghi nào bị sửa khi đăng nhập thất bại) — việc
này bạn (app `accounts`) phải tự gọi hàm ghi log tại đúng những điểm: login
thành công/thất bại, logout, đổi password, khóa tài khoản.

## Vì sao Audit Log của riêng phần Auth quan trọng hơn các module khác

Audit log của `client` hay `job` ghi "ai sửa gì" để tra cứu khi tranh chấp
trách nhiệm nghiệp vụ. Nhưng audit log của Auth (`LOGIN_FAILED`,
`ACCOUNT_LOCKED`) còn có vai trò **phát hiện tấn công đang diễn ra** — ví dụ
nếu 1 email có 200 lần `LOGIN_FAILED` trong 5 phút từ nhiều IP khác nhau, đó
là dấu hiệu rõ ràng của brute-force attack, và đây là dữ liệu để cảnh báo
sớm, không chỉ để tra cứu lịch sử.

## Câu hỏi tự kiểm tra

1. Giữa `django-simple-history` và tự viết hàm ghi log riêng cho từng action
   của Auth, vì sao 2 cách này không loại trừ nhau mà cần dùng song song?
2. Nếu hệ thống chỉ ghi `LOGIN_FAILED` nhưng không ghi kèm IP address, bạn sẽ
   gặp khó khăn gì khi điều tra một vụ brute-force?
