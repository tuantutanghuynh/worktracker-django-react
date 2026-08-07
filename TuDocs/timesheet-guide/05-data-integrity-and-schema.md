# 05 — Data Integrity & Schema: Vì sao thiết kế bảng như vậy

## Vì sao `hours_spent` dùng `DECIMAL`, không dùng `FLOAT`

```python
hours_spent = models.DecimalField(max_digits=4, decimal_places=2)
```

Đây không phải chi tiết vụn vặt — là một lỗi kinh điển nếu chọn sai. `FLOAT`
(và `DOUBLE`) lưu số dưới dạng nhị phân xấp xỉ (binary floating point) —
một số thập phân tưởng đơn giản như `0.1` thực ra **không có biểu diễn nhị
phân chính xác**, máy tính lưu nó thành một giá trị gần đúng. Hậu quả thực
tế:

```text
0.1 + 0.2 (dùng FLOAT)  →  0.30000000000000004   (không phải 0.3 chính xác)
```

Với dữ liệu dùng để **tính lương**, sai số này tích lũy qua hàng trăm bản ghi
có thể dẫn tới lệch lương vài đồng tới vài chục nghìn — nhỏ nhưng **không thể
chấp nhận được** về mặt kế toán (kế toán yêu cầu khớp số tuyệt đối, không
chấp nhận "gần đúng"). `DECIMAL` lưu số dưới dạng thập phân chính xác (không
quy đổi sang nhị phân), đảm bảo `8.00 + 1.50 = 9.50` chính xác tuyệt đối,
không sai số.

`max_digits=4, decimal_places=2` nghĩa là tối đa 4 chữ số, 2 sau dấu phẩy —
cho phép giá trị tới `99.99`. Vì giới hạn nghiệp vụ là `<= 24` (1 ngày tối đa
24 giờ), 4 chữ số là dư thoải mái, không cần lo tràn số.

## Vì sao tách riêng `log_works` (chi tiết) và `daily_user_timesheets` (tổng hợp) — không gộp 1 bảng

Đây là câu hỏi rất hay gặp: "tổng giờ trong ngày" hoàn toàn có thể tính được
bằng `SUM(hours_spent) FROM log_works WHERE user_id=X AND work_date=Y` —
vậy sao cần thêm 1 bảng tổng hợp riêng?

Lý do liên quan trực tiếp tới file 02 (Race Condition): nếu mỗi lần log work
mới đều phải `SUM()` lại toàn bộ `log_works` để kiểm tra giới hạn 24h, câu
`SUM()` đó **không khóa được** theo kiểu `SELECT ... FOR UPDATE` một cách
hiệu quả — `FOR UPDATE` khóa từng **dòng** cụ thể, còn `SUM()` là một phép
tính trên **nhiều dòng**, khóa kiểu này (range lock/table lock) đắt đỏ hơn
nhiều và dễ gây deadlock khi nhiều người dùng cùng lúc.

`daily_user_timesheets` giải quyết bằng cách giữ **một con số đã tính sẵn**
(`total_hours`) cho mỗi `(user, work_date)` — chỉ cần khóa **đúng 1 dòng duy
nhất** đó (`FOR UPDATE` trên primary key, rất rẻ và nhanh) để kiểm tra +
cập nhật. Đây là kỹ thuật gọi là **denormalization có chủ đích** (lưu dữ
liệu trùng/tính sẵn để đổi lấy hiệu năng và khả năng khóa chính xác) — đánh
đổi là phải đảm bảo 2 bảng luôn đồng bộ (mỗi lần insert `log_works` phải
cập nhật `daily_user_timesheets` **trong cùng transaction**, đúng như luồng
ở file 03).

## Vì sao Primary Key của `daily_user_timesheets` là cặp `(user, work_date)` — Composite Key

```python
class Meta:
    constraints = [
        models.UniqueConstraint(fields=['user', 'work_date'], name='unique_daily_user_timesheet'),
    ]
```

Về bản chất nghiệp vụ: "tổng giờ làm của nhân viên X trong ngày Y" là **một
sự thật duy nhất** — không thể có 2 dòng cùng `(X, Y)` với 2 giá trị
`total_hours` khác nhau, vô nghĩa. Composite unique constraint đảm bảo điều
này ở tầng Database — không phụ thuộc vào code Django có nhớ check hay
không.

## Vì sao `log_works.id` dùng `BigAutoField` (BIGINT) thay vì `AutoField` (INT) thông thường

```python
id = models.BigAutoField(primary_key=True)
```

`INT` thường (32-bit) giới hạn khoảng 2.1 tỷ giá trị. Nghe có vẻ rất nhiều,
nhưng tài liệu lưu ý: *"Sử dụng BIGINT vì dữ liệu bảng này sẽ phình to cực kỳ
nhanh mỗi ngày."* Thử tính: 100 nhân viên × 3 dòng log/ngày × 250 ngày
làm/năm = 75,000 dòng/năm — với 1 công ty thì còn lâu mới chạm giới hạn INT.
Nhưng đây là **quyết định kiến trúc phòng xa** (defensive design, không phải
defensive code) — đổi từ `INT` sang `BIGINT` *sau khi* hệ thống đã chạy nhiều
năm và bảng đã có hàng trăm triệu dòng là một thao tác migration **cực kỳ
rủi ro và chậm** (phải khóa bảng, viết lại toàn bộ index). Chọn `BIGINT`
ngay từ đầu cho bảng "tăng trưởng nhanh" tốn vài byte dư mỗi dòng, nhưng
loại bỏ hoàn toàn rủi ro phải migrate giữa lúc hệ thống đang chạy production.

## Vì sao `task` trong `LogWork` dùng `on_delete=RESTRICT`, không phải `CASCADE`

```python
task = models.ForeignKey('tasks.Task', on_delete=models.RESTRICT, ...)
```

`CASCADE` nghĩa là "xóa Task thì tự động xóa luôn mọi LogWork liên quan".
`RESTRICT` nghĩa là "không cho xóa Task nếu vẫn còn LogWork trỏ tới nó".
Đối chiếu nghiệp vụ: LogWork là dữ liệu **đã dùng để tính lương** — nếu cho
phép xóa Task kéo theo xóa sạch lịch sử giờ làm liên quan, công ty **mất
chứng từ đã trả lương** mà không hay biết. `RESTRICT` buộc người muốn xóa
Task phải xử lý LogWork liên quan một cách có chủ đích trước (ví dụ không
cho xóa, chỉ cho "archive" Task) — tài liệu gọi đây là *"Ràng buộc sinh tử"*.

## Câu hỏi tự kiểm tra

1. Nếu một ngày nào đó nghiệp vụ đổi: cho phép nhân viên sửa `hours_spent`
   của một dòng `log_works` đã tạo trước đó (hiện chưa có API này), việc cập
   nhật `daily_user_timesheets.total_hours` theo đó cần xử lý race condition
   giống lúc tạo mới không? Vì sao?
2. Giả sử công ty mở rộng, một nhân viên có thể làm việc cho 2 task khác
   nhau trong cùng 1 ngày, mỗi task log riêng. `daily_user_timesheets` có
   phân biệt theo `task` không? Việc gộp theo `(user, work_date)` mà không
   theo `task` có ảnh hưởng gì tới việc tính tổng giờ giới hạn 24h/ngày?
