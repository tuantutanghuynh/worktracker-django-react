# 07 — Edge Cases & những lỗ hổng dễ bị bỏ sót

Phần lớn bug nghiêm trọng trong module này không nằm ở "logic chính" (đã
phân tích kỹ ở file 02-04) mà nằm ở các trường hợp biên ít người nghĩ tới khi
mới code. Đây là danh sách để bạn tự rà soát trước khi cho rằng đã "code
xong".

## 1. Sửa/Xóa một `log_work` đã tồn tại — race condition kiểu khác

Toàn bộ file 02-03 phân tích trường hợp **tạo mới**. Nếu sau này có API
"sửa" hoặc "xóa" một dòng `log_works` đã tồn tại (ví dụ nhân viên log nhầm
số giờ, muốn sửa lại), bài toán race condition **lặp lại tương tự nhưng
ngược chiều**:

```text
Sửa hours_spent từ 3 → 5 (tăng 2 giờ)
   → daily_user_timesheets.total_hours phải +2, vẫn cần FOR UPDATE,
     vẫn cần check lại có vượt 24h không sau khi sửa

Xóa dòng log_work có hours_spent = 3
   → daily_user_timesheets.total_hours phải -3, vẫn cần FOR UPDATE
     (dù chiều giảm không thể "vượt 24h", nhưng vẫn cần khóa dòng để
     tránh 2 request sửa/xóa cùng lúc ghi đè kết quả của nhau)
```

Và quan trọng nhất: **API sửa/xóa cũng phải tự kiểm tra Time Lock** — nếu
không, nhân viên có thể né "không cho log work mới vào kỳ đã khóa" bằng cách
**sửa một dòng log work cũ** (tạo từ trước khi khóa) để tăng số giờ lên. Đây
là lỗ hổng rất dễ bị bỏ sót vì người code thường chỉ nhớ chặn Time Lock ở
API "tạo mới".

## 2. Xóa Task đang có Log Work

Đã nói ở file 05: `on_delete=RESTRICT` chặn việc này ở tầng Database. Nhưng
cần đảm bảo **API xóa Task** (thuộc app `tasks`, do thành viên khác code)
**bắt được exception** này và trả về lỗi rõ ràng cho người dùng (ví dụ
"Không thể xóa Task đã có giờ làm được ghi nhận"), không phải để lỗi
`IntegrityError` (HTTP 500) thô tung ra màn hình. Đây là điểm cần **trao đổi
chéo với người phụ trách app `tasks`** — RESTRICT chỉ bảo vệ dữ liệu, không
tự tạo UX tốt; cần code xử lý exception ở nơi gọi.

## 3. Time zone — ngày làm việc tính theo giờ nào

`work_date` là `DateField` (chỉ có ngày, không có giờ) — nhưng `created_at`
là `DateTimeField` (có cả giờ, có time zone). Nếu nhân viên log work lúc
23:50 giờ Việt Nam, nhưng server Django chạy với `TIME_ZONE = 'UTC'` (đúng
như cấu hình hiện tại trong `settings.py` của dự án), giờ UTC tương ứng đã
là ngày hôm sau. Vấn đề chỉ phát sinh nếu code **tự suy ra `work_date` từ
`created_at`** — nếu `work_date` luôn do người dùng **chọn rõ ràng** trên
form (đúng như thiết kế form ở file 06), vấn đề time zone không ảnh hưởng
tới `work_date`. Nhưng vẫn cần lưu ý khi hiển thị `created_at` trên UI Review
(file 06) — phải convert đúng time zone Việt Nam khi hiển thị, không hiển
thị giờ UTC thô gây nhân viên/Manager đọc nhầm thời điểm log.

## 4. Một Task bị chuyển sang trạng thái `CANCELLED` — còn log work được không?

Tài liệu không nói rõ. Đây là câu hỏi nghiệp vụ cần hỏi team: nếu Task đã bị
Manager hủy (`status = CANCELLED`), nhân viên còn được log giờ làm cho Task
đó không? Về logic, có vẻ vô lý ("task đã hủy, sao còn log work"), nhưng nếu
không chặn, dữ liệu vẫn "đúng kỹ thuật" — chỉ là vô nghĩa nghiệp vụ. Đây là
loại câu hỏi nên **chủ động hỏi trước khi code**, không tự đoán rồi code theo
ý mình, vì nó ảnh hưởng tới logic kiểm tra ở API log-work.

## 5. Permission check cho API Log Work — ai được log cho Task nào

Nhìn lại file 04 (auth-guide), permission của EMPLOYEE là `timesheet:create`
— nhưng giống bài học ở `04-rbac-and-data-isolation.md`, có permission
`timesheet:create` không có nghĩa là **log được cho BẤT KỲ Task nào**. Phải
kiểm tra thêm: Task đó có đang được giao (`assignee`) cho chính
`request.user` không?

```python
if task.assignee != request.user:
    raise PermissionDenied("Không thể log work cho task không được giao cho bạn")
```

Thiếu kiểm tra này, một nhân viên có thể log giờ làm cho Task của đồng
nghiệp (vô tình hoặc cố ý gian lận giờ công) — đúng dạng lỗ hổng Data
Isolation đã học, áp dụng lại ở module này.

## 6. Locked period nhưng vẫn cho phép Manager/Admin ghi đè (override)?

Tài liệu nói nhân viên bị chặn khi kỳ đã khóa. Nhưng Admin (người có quyền
cao nhất) có cần một cách "ghi đè" trong trường hợp đặc biệt (ví dụ phát
hiện sai sót nghiêm trọng cần sửa gấp dữ liệu lương đã khóa) không? Nếu có,
logic kiểm tra Time Lock ở file 03 cần thêm 1 nhánh: *"nếu request.user có
permission đặc biệt (ví dụ `timesheet:override_lock`), bỏ qua Lớp phòng thủ
1"*. Đây lại là câu hỏi nghiệp vụ cần chốt với team trước khi code, không
phải lỗi kỹ thuật.

## Checklist edge case để tự rà trước khi báo "xong"

- [ ] Sửa/xóa log work cũ có tự cập nhật lại `daily_user_timesheets` không?
- [ ] Sửa/xóa log work cũ có tự kiểm tra Time Lock không (không chỉ API tạo mới)?
- [ ] API xóa Task xử lý exception `RESTRICT` thân thiện, không trả lỗi 500 thô?
- [ ] Hiển thị thời gian trên UI Review đã convert đúng time zone Việt Nam?
- [ ] Đã hỏi rõ với team: Task `CANCELLED` còn cho log work không?
- [ ] API log-work kiểm tra `task.assignee == request.user`, không chỉ check permission chung?
- [ ] Đã hỏi rõ với team: có cần cơ chế Admin override Time Lock không?

## Câu hỏi tự kiểm tra

1. Trong 7 edge case trên, case nào nếu bỏ sót sẽ gây **sai dữ liệu lương**
   (nghiêm trọng nhất), case nào chỉ gây **trải nghiệm xấu** (ít nghiêm
   trọng hơn)? Thử tự xếp hạng độ ưu tiên sửa.
2. Case số 5 (assignee check) và case về Data Isolation ở `auth-guide` file
   04 có chung một nguyên tắc nền tảng nào? Thử diễn đạt lại nguyên tắc đó
   bằng 1 câu của riêng bạn.
