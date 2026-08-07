# 02 — Race Condition, Transaction, và Pessimistic Locking

Đây là file quan trọng nhất trong series — nắm chắc file này thì phần còn
lại chỉ là chi tiết hóa.

## Race Condition là gì — ví dụ cụ thể bằng số

Giả sử nhân viên A đã log 20 giờ trong ngày 30/05. Họ mở 2 tab, cùng lúc bấm
Submit log thêm 3 giờ ở mỗi tab (mạng lag, tưởng tab đầu chưa gửi). Nếu code
không phòng thủ, chuyện gì xảy ra:

```text
Thời điểm    Request A (tab 1)              Request B (tab 2)
─────────    ──────────────────              ──────────────────
t1           SELECT total_hours → 20
t2                                            SELECT total_hours → 20   (đọc CÙNG giá trị 20,
                                                                          vì A chưa kịp ghi xong)
t3           Tính: 20 + 3 = 23 (hợp lệ)
t4           UPDATE total_hours = 23
t5                                            Tính: 20 + 3 = 23 (hợp lệ, vì B vẫn dùng số 20
                                                                  đọc được lúc t2, không biết A
                                                                  đã ghi 23)
t6                                            UPDATE total_hours = 23   ← SAI! Phải là 26
```

Kết quả cuối: `total_hours = 23`, nhưng thực tế nhân viên đã log tổng 26 giờ
(20 + 3 + 3). Tệ hơn, **cả 2 dòng `log_works` đều được ghi** (mỗi cái 3 giờ),
nên nếu cộng dồn từ `log_works` ra sẽ ra 26h — `daily_user_timesheets` (bảng
tổng hợp) và `log_works` (bảng chi tiết) lúc này **lệch nhau**, dữ liệu mất
tính nhất quán (consistency). Đây chính là Race Condition: **kết quả cuối
cùng phụ thuộc vào "ai chạy trước, ai chạy sau" một cách không kiểm soát
được**, trong khi đáng ra phải luôn đúng dù chạy theo thứ tự nào.

Đáng sợ hơn: nếu nhân viên cố ý lợi dụng race condition này, họ có thể nhập
giờ vượt 24h/ngày mà constraint tưởng đã chặn — vì mỗi request riêng lẻ nhìn
qua đều "hợp lệ" tại thời điểm nó tính toán.

## Transaction và ACID — nền tảng cần biết trước khi học Locking

Một Transaction là một nhóm các câu lệnh DB (SELECT/UPDATE/INSERT) được đảm
bảo **chạy như một đơn vị duy nhất, không thể bị chia cắt nửa chừng**. Tính
chất quan trọng nhất ở đây là chữ "I" trong ACID — **Isolation**: các
transaction chạy đồng thời không được "thấy" trạng thái nửa-vời của nhau.

```text
BEGIN TRANSACTION
    SELECT ... FOR UPDATE   -- đọc + khóa dòng
    -- tính toán
    UPDATE ...
    INSERT ...
COMMIT   -- chỉ tới đây các thay đổi mới thực sự "có hiệu lực" với người khác
```

Nếu có lỗi giữa đường (ví dụ vượt 24h, ném exception), gọi `ROLLBACK` —
toàn bộ thay đổi trong transaction đó bị hủy, như chưa từng xảy ra. Đây là lý
do tài liệu nói: *"Nếu vượt 24h, DB sẽ tự động Rollback giao dịch nhờ ràng
buộc vật lý."*

## Pessimistic Locking — `SELECT ... FOR UPDATE` giải quyết Race Condition thế nào

Quay lại ví dụ ở trên, nếu dùng `SELECT ... FOR UPDATE`:

```text
Thời điểm    Request A (tab 1)                      Request B (tab 2)
─────────    ──────────────────                      ──────────────────
t1           BEGIN; SELECT ... FOR UPDATE → 20
                (khóa dòng work_date=30/05, user=A)
t2                                                     BEGIN; SELECT ... FOR UPDATE
                                                        → BỊ CHẶN (chờ), vì dòng đang bị A khóa
t3           Tính 20+3=23, UPDATE, COMMIT
                (nhả khóa)
t4                                                     → được tiếp tục chạy, đọc lại,
                                                          LẦN NÀY thấy total_hours = 23
                                                          (giá trị MỚI NHẤT, không phải 20 cũ)
t5                                                     Tính 23+3=26, UPDATE, COMMIT
```

Kết quả cuối: `26` — đúng. Tên gọi "Pessimistic" (bi quan) vì cách tiếp cận
này **giả định luôn có khả năng đụng độ, nên khóa trước, chặn người khác chờ
ngay từ đầu** — khác với "Optimistic Locking" (lạc quan: cứ cho chạy song
song, tới lúc ghi mới kiểm tra xem có ai ghi đè không, nếu có thì thử lại).
Với bài toán tiền lương (chính xác quan trọng hơn tốc độ), Pessimistic phù
hợp hơn vì đơn giản, chắc chắn đúng — đánh đổi là request B phải **chờ**
(thường chỉ vài chục milliseconds, không đáng kể).

## Cách Django thực hiện điều này (ý tưởng, chưa phải code cuối)

```python
from django.db import transaction

with transaction.atomic():
    timesheet = DailyUserTimesheet.objects.select_for_update().get(
        user=request.user, work_date=work_date
    )
    if timesheet.total_hours + new_hours > 24:
        raise ValidationError("Vượt quá 24 giờ trong ngày")
    timesheet.total_hours += new_hours
    timesheet.save()
    LogWork.objects.create(user=request.user, work_date=work_date, hours_spent=new_hours, ...)
```

`transaction.atomic()` mở transaction (tương đương `BEGIN ... COMMIT`).
`select_for_update()` chính là `SELECT ... FOR UPDATE`. Nếu dòng
`DailyUserTimesheet` cho `(user, work_date)` đó **chưa tồn tại** (lần đầu
nhân viên log giờ trong ngày), bạn cần tạo trước (`get_or_create`) — đây là
chi tiết cần lưu ý khi code thật, không phải lúc này.

## Vì sao không cần lo Race Condition khi đọc dữ liệu (chỉ cần lo khi GHI)

Một câu hỏi hay gặp: vậy khi Manager xem báo cáo (chỉ đọc, không ghi) có cần
`FOR UPDATE` không? **Không** — Race Condition chỉ là vấn đề khi có từ 2
request **cùng ghi** vào cùng 1 dòng dữ liệu mà việc ghi phụ thuộc vào giá
trị đọc trước đó (kiểu "đọc - tính - ghi lại", gọi là *read-modify-write*).
Đọc thuần túy (không ghi gì) không bao giờ gây race condition, dù có 1000
người đọc cùng lúc.

## Câu hỏi tự kiểm tra

1. Nếu bỏ `select_for_update()` nhưng vẫn giữ `transaction.atomic()`, race
   condition ở ví dụ đầu bài có còn xảy ra không? Vì sao `atomic()` một mình
   không đủ?
2. Request B trong ví dụ phải "chờ" Request A commit xong. Nếu Request A vì
   lý do nào đó treo rất lâu (ví dụ 30 giây) trước khi commit, điều gì xảy ra
   với Request B và với trải nghiệm của nhân viên đang chờ Submit?
