# 02 — JWT, Access/Refresh Token, Rotation, Blacklist

## JWT thực chất là gì

JWT = JSON Web Token. Cấu trúc là 3 phần nối bằng dấu `.`:

```text
header.payload.signature

eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjo1LCJyb2xlIjoiQURNSU4ifQ.4f8a2b...
└─ header ─┘└──────── payload ────────┘└── signature ──┘
```

- **Header**: thuật toán mã hóa (ví dụ HS256).
- **Payload**: dữ liệu thật — theo yêu cầu của bạn sẽ chứa `user_id`, `email`,
  `role` (xem `WorkTracker_Authentication_Guide.md` mục "JWT").
- **Signature**: chữ ký số tạo ra từ `header + payload + SECRET_KEY` của
  Django. Đây là phần quan trọng nhất — nó đảm bảo **không ai sửa được payload
  mà không bị phát hiện**, vì sửa payload sẽ làm signature không khớp nữa.

Điểm hay nhầm của người mới: **payload JWT không được mã hóa, chỉ được mã hóa
Base64 — ai cũng đọc được nội dung** (thử paste 1 JWT vào jwt.io sẽ thấy
ngay). JWT bảo vệ bằng cách **chống sửa**, không phải **chống đọc**. Vì vậy:
không bao giờ nhét password hay dữ liệu nhạy cảm vào payload.

## Vì sao có 2 loại token (Access + Refresh)?

Đánh đổi giữa bảo mật và trải nghiệm người dùng:

| | Access Token | Refresh Token |
|---|---|---|
| Thời hạn | 15 phút | 7 ngày |
| Dùng để | Gửi kèm mỗi API request | Chỉ dùng để xin Access Token mới |
| Nếu bị lộ | Hacker chỉ dùng được tối đa 15 phút | Hacker dùng được tới 7 ngày — nguy hiểm hơn nhiều |

Nếu chỉ có 1 loại token sống 7 ngày, người dùng tiện (không phải đăng nhập
lại liên tục) nhưng nếu token đó bị đánh cắp thì hacker có 7 ngày để lộng
hành. Tách 2 token giải quyết được: token "đi đường" (access) sống ngắn nên
rủi ro thấp, còn token "ở nhà" (refresh — chỉ gọi 1 endpoint duy nhất
`/api/token/refresh/`) sống dài nhưng bề mặt tấn công nhỏ hơn nhiều.

## Refresh Token Rotation — vấn đề nó giải quyết

Nếu Refresh Token dùng được nhiều lần trong 7 ngày, một khi nó bị đánh cắp
(ví dụ qua XSS), hacker và user thật **cùng dùng song song** một refresh token
mà hệ thống không biết. Rotation giải quyết bằng cách: **mỗi lần refresh
token được dùng để xin access token mới, nó bị vô hiệu hóa và một refresh
token mới được phát hành**.

```text
SIMPLE_JWT = {
    "ROTATE_REFRESH_TOKENS": True,       # dùng 1 lần thì refresh token cũ chết
    "BLACKLIST_AFTER_ROTATION": True,    # token cũ bị đưa vào blacklist ngay
}
```

Hệ quả thực tế: nếu cả hacker và user thật cùng cầm 1 refresh token, **ai dùng
trước thắng** — người dùng sau (kể cả là chủ tài khoản thật) sẽ bị từ chối, vì
token đã rotate. Đây là dấu hiệu để phát hiện token bị đánh cắp (nếu user thật
than phiền "tự nhiên bị đăng xuất", đó là tín hiệu điều tra).

## Blacklist khi Logout — vì sao không lưu trong Postgres

JWT là stateless — bản chất Django *không thể* "hủy" một token đã phát hành
giữa đường, vì không tra DB để xác thực nữa (file 01 đã nói). Vậy logout xử
lý ra sao?

Giải pháp: giữ một **danh sách đen (blacklist)** các token đã bị logout, và
kiểm tra danh sách đó *trước khi* tin token. Câu hỏi quan trọng: lưu blacklist
ở đâu?

Tài liệu yêu cầu chỉ định rõ — dùng **Redis**, không dùng Postgres:

```text
Lưu ý Kiến trúc: Quản lý Blacklist Token khi đăng xuất được xử lý 100% trên
In-memory Cache (Redis) bằng lệnh SETEX với định danh JTI, không lưu trữ
trong MySQL để đảm bảo hiệu năng O(1).
```

Lý do kỹ thuật:

1. **Tốc độ**: mọi request có token đều phải tra blacklist trước khi xử lý.
   Nếu tra Postgres (disk-based, có index B-tree), độ trễ tăng theo cấp số.
   Redis là in-memory, tra theo key là O(1) — gần như tức thì.
2. **Tự dọn dẹp**: lệnh `SETEX key value <giây>` của Redis tự động xóa key
   sau thời gian chỉ định. Đặt thời gian sống của blacklist entry = thời gian
   còn lại của access token (`exp - now`). Sau khi token tự hết hạn tự nhiên,
   entry blacklist cũng tự biến mất — không cần cronjob dọn bảng như nếu lưu
   trong Postgres.
3. **JTI là gì**: mỗi JWT có một claim `jti` (JWT ID) — một UUID duy nhất cho
   từng token được phát hành. Blacklist lưu theo `jti`, không lưu cả token
   (ngắn hơn, đỡ tốn bộ nhớ).

```text
Logout
 ↓
Lấy JTI từ token đang dùng
 ↓
Redis: SETEX blacklist:<jti> <thời_gian_còn_lại> "1"
 ↓
Các request sau dùng cùng token này → check Redis thấy jti bị blacklist → 401
```

## Liên hệ tới "Offboarding" (khóa tài khoản nhân viên)

`all worktracker features-fix.docx` yêu cầu: khi Admin khóa tài khoản, hệ
thống phải "đẩy is_active = False **và đồng thời** gọi một hàm để xóa Refresh
Token của người này... ép họ văng khỏi hệ thống lập tức". Đây thực chất là
**cùng cơ chế blacklist** ở trên, nhưng được trigger không phải bởi hành động
logout của chính user, mà bởi hành động của Admin. Bạn sẽ cần một hàm dùng lại
được ở cả 2 nơi: logout thông thường và admin-disable-account.

## Câu hỏi tự kiểm tra

1. Nếu Redis server bị crash, điều gì xảy ra với cơ chế logout? Hệ thống có
   "mở khóa" lại cho các token đã logout không? (Gợi ý: blacklist không còn
   tồn tại nếu Redis mất dữ liệu — đây là rủi ro cần biết, không phải để bạn tự
   sửa, nhưng phải hiểu để trả lời khi team hỏi).
2. Access token 15 phút, Refresh token 7 ngày. Nếu user không mở web trong 8
   ngày rồi quay lại, điều gì xảy ra? Họ có phải đăng nhập lại bằng
   email/password không?
