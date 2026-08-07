# 04 — Luồng Time Lock (Chốt sổ kỳ báo cáo)

## Ai bấm nút "Khóa", ai code API

Theo `all worktracker features-fix.docx` (mục Manager — "Đánh giá Báo cáo &
Khóa Log Work"), **Manager** là người dùng cuối bấm nút "Chốt báo cáo
tuần/tháng" trên UI. Nhưng theo phân chia công việc gốc, **API backend cho
hành động này thuộc về bạn** (app `timesheets`) — Manager chỉ là người gọi
API đó qua giao diện, không có nghĩa là người code API đó là Minh Anh hay
thành viên 3. Đây là điểm hay nhầm: "ai dùng tính năng" và "ai code tính
năng" là 2 câu hỏi khác nhau, quyết định bởi **app nào chứa bảng dữ liệu
liên quan** (ở đây là `time_locks`, thuộc app `timesheets` của bạn).

## Sơ đồ luồng Khóa kỳ báo cáo

```text
[1] FE (Manager): chọn tháng + năm muốn khóa, bấm "Chốt báo cáo"
       ↓
[2] FE: POST /api/timesheets/time-locks/  { lock_month: 5, lock_year: 2026 }
       ↓
[3] BE: kiểm tra quyền — chỉ MANAGER/ADMIN có permission "timesheet:lock"
       mới gọi được (xem lại file 04 trong auth-guide — đây chính là RBAC
       permission check áp dụng thực tế ở module khác)
       ↓
[4] BE: kiểm tra đã có time_lock cho (lock_month, lock_year) này chưa?
       - Đã có và is_locked=True → trả lỗi "Kỳ này đã được khóa trước đó"
       - Đã có và is_locked=False → UPDATE lại is_locked=True
       - Chưa có → INSERT mới (lock_month, lock_year, is_locked=True,
         locked_by=request.user)
       ↓
[5] BE: trả 201/200, kèm thông tin time_lock vừa tạo/cập nhật
       ↓
[6] Từ giờ, MỌI request log-work (xem file 03) có work_date rơi vào
    tháng/năm này → bị chặn ở Lớp phòng thủ 1
```

## Vì sao có ràng buộc `UNIQUE(lock_month, lock_year)` — đối chiếu với bước [4]

Model `TimeLock` đã có sẵn:

```python
constraints = [
    models.UniqueConstraint(fields=['lock_month', 'lock_year'], name='unique_lock_month_year')
]
```

Ràng buộc này là **lưới an toàn tầng Database** cho đúng race condition kiểu
khác: nếu 2 Manager cùng bấm "Khóa tháng 5/2026" gần như đồng thời (hiếm
nhưng có thể), không có ràng buộc này có thể sinh ra **2 dòng `time_lock`
trùng lặp** cho cùng 1 kỳ — gây rối khi sau này truy vấn "kỳ này đã khóa
chưa" (query trả về 2 dòng, logic code phải xử lý thêm trường hợp không
đáng có). `UniqueConstraint` đảm bảo Database tự chặn việc này, code Backend
không cần tự kiểm tra phức tạp — chỉ cần bắt exception
`IntegrityError`/`django.db.utils.IntegrityError` khi insert trùng và trả
lỗi phù hợp.

## Mở khóa (Unlock) — có cần tính tới không?

Tài liệu không nói rõ có API "mở khóa lại" hay không, nhưng model
`is_locked` là `BooleanField`, không phải chỉ có hành động "khóa" một
chiều — gợi ý rằng thiết kế cho phép **đảo trạng thái** (ví dụ Manager khóa
nhầm tháng, hoặc cần mở lại để sửa một sai sót phát hiện sau khi đã khóa).
Đây là điểm bạn nên **chủ động hỏi team/giảng viên** trước khi code: có cần
API Unlock không, và nếu có, ai có quyền (chỉ ADMIN, hay cả MANAGER đã khóa
được tự mở lại)? Việc đặt câu hỏi này trước khi code thể hiện bạn hiểu rõ
phạm vi nghiệp vụ, không chỉ implement đúng những gì đã viết sẵn.

## Liên hệ giữa Time Lock và Data Isolation (đã học ở auth-guide)

Một câu hỏi quan trọng: Manager A khóa kỳ báo cáo của **team mình**. Manager
B (team khác) có bị ảnh hưởng không? Nhìn vào model `TimeLock`, trường khóa
là `(lock_month, lock_year)` — **không có trường nào gắn với team/department
cụ thể**. Điều này có nghĩa: theo thiết kế hiện tại, khóa kỳ báo cáo là
**khóa toàn công ty cho tháng đó**, không phải khóa riêng từng team.

Đối chiếu với câu trong tài liệu Manager: *"Nếu Manager A khóa dữ liệu của
Team A, các nhân viên thuộc Team A sẽ bị Backend từ chối..."* — câu này dùng
chữ "Team A" khiến người đọc dễ hiểu lầm là khóa theo team. Đây là một **điểm
mâu thuẫn giữa câu chữ mô tả tính năng và thiết kế bảng thật** mà bạn nên nêu
ra trong buổi họp team để chốt lại: khóa theo tháng cho toàn công ty (đúng
model hiện tại, đơn giản hơn), hay cần thêm field để khóa theo từng
team/department riêng (phức tạp hơn, cần sửa model trước khi code)?

## Câu hỏi tự kiểm tra

1. Nếu thiết kế thực sự cần "khóa riêng theo từng Manager/team" như câu mô
   tả tính năng gợi ý, bảng `TimeLock` cần thêm cột gì? Ràng buộc
   `UniqueConstraint` hiện tại có cần đổi theo không?
2. Một nhân viên đã log 10 giờ vào ngày 15/5. Sau đó Manager khóa tháng 5.
   Manager sau đó phát hiện cần sửa lại số giờ đó (nhân viên báo nhập sai).
   Theo flow hiện tại (không có API Unlock), Manager làm được việc này
   không? Nếu không, hệ thống có đang thiếu một tính năng cần thiết?
