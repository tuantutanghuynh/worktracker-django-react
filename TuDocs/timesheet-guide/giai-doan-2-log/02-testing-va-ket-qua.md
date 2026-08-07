# 02 — Testing & Kết quả thực tế

## Chuẩn bị

Trước khi test, kiểm tra lại `daily_user_timesheets` — bảng này trống, vì
logic Giai đoạn 1 (cũ) chưa từng đụng tới nó:

```bash
python manage.py shell -c "
from timesheets.models import DailyUserTimesheet, LogWork
print(list(DailyUserTimesheet.objects.all()))
"
```
```text
[]
```

Dùng lại Task id=1 (gán cho `employee@worktracker.com`) đã tạo từ Giai đoạn
1. Test trên `work_date` mới (`2026-07-19`, `2026-07-20`) để không lẫn với
`log_work` id=1 đã tạo ở lần test trước.

## Test 1 — Log 5h (kỳ vọng 201, `total_hours` = 5)

```bash
curl -s http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-19", "hours_spent": "5", "description": "t1"}'
```
```text
{"id":2,"task":1,"work_date":"2026-07-19","hours_spent":"5.00","description":"t1"}
```
✅ Đúng kỳ vọng.

## Test 2 — Log thêm 18h cùng ngày (kỳ vọng 201, `total_hours` = 23)

```bash
curl -s http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-19", "hours_spent": "18", "description": "t2"}'
```
```text
{"id":3,"task":1,"work_date":"2026-07-19","hours_spent":"18.00","description":"t2"}
```
✅ Đúng kỳ vọng — xác nhận logic cộng dồn đọc đúng giá trị mới nhất (5 → 23,
không phải tính lại từ 0).

## Test 3 — Log thêm 5h nữa, 23+5=28 > 24 (kỳ vọng 400 + rollback sạch)

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-19", "hours_spent": "5", "description": "should fail"}'
```
```text
{"hours_spent":"Total hours for 2026-07-19 would exceed 24h (currently 23.00h, tried to add 5.00h)."}
HTTP_STATUS:400
```
✅ Đúng kỳ vọng.

### Xác nhận rollback thật — không chỉ tin response, kiểm tra thẳng DB

```bash
python manage.py shell -c "
from timesheets.models import DailyUserTimesheet, LogWork
d = DailyUserTimesheet.objects.get(user_id=3, work_date='2026-07-19')
print('total_hours =', d.total_hours)
print('so dong log_works:', LogWork.objects.filter(user_id=3, work_date='2026-07-19').count())
"
```
```text
total_hours = 23.00
so dong log_works: 2
```
✅ `total_hours` vẫn là 23 (không bị ghi thành 28), và chỉ có đúng 2 dòng
`log_works` (lần fail không để lại rác) — xác nhận `transaction.atomic()`
rollback đúng cả 2 bảng cùng lúc.

## Test 4 — Race Condition thật: 2 request `curl` chạy song song

Đây là test quan trọng nhất của Giai đoạn 2 — khác 3 test trên (chạy tuần
tự), test này bắn **2 tiến trình `curl` thật sự đồng thời** bằng `&`/`wait`
của bash, mỗi request 15h vào cùng `work_date` mới (`2026-07-20`, tổng
`daily_user_timesheets` đang là 0). Từng request riêng lẻ hợp lệ (15h <
24h), nhưng cộng lại 30h > 24h — đúng kịch bản race condition đã phân tích
lý thuyết ở `timesheet-guide/02-race-condition-and-transactions.md`.

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-20", "hours_spent": "15", "description": "race-A"}' > /tmp/race_a.txt &
PID_A=$!

curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://127.0.0.1:8000/api/timesheets/log-works/ -X POST \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"task": 1, "work_date": "2026-07-20", "hours_spent": "15", "description": "race-B"}' > /tmp/race_b.txt &
PID_B=$!

wait $PID_A $PID_B
cat /tmp/race_a.txt
cat /tmp/race_b.txt
```

Kết quả:
```text
=== Request A ===
{"id":4,"task":1,"work_date":"2026-07-20","hours_spent":"15.00","description":"race-A"}
HTTP_STATUS:201

=== Request B ===
{"hours_spent":"Total hours for 2026-07-20 would exceed 24h (currently 15.00h, tried to add 15.00h)."}
HTTP_STATUS:400
```

✅ **Đúng kỳ vọng, và đây là điểm quan trọng nhất**: Request B nhận message
`"currently 15.00h"` — nghĩa là B đã **CHỜ** A `COMMIT` xong rồi mới đọc
được `total_hours`, không đọc phải giá trị cũ `0` (giống ví dụ race condition
sai ở file `02`, nơi cả 2 request đều đọc `20` cùng lúc). Đây chính là bằng
chứng thật `select_for_update()` đã khóa đúng dòng, buộc request thứ 2 phải
tuần tự hóa (serialize) thay vì chạy song song mù thông tin của nhau.

Nếu **không có** `select_for_update()` (dùng `.get()` thường), kịch bản
nhiều khả năng xảy ra: cả A và B đều đọc `total_hours=0` gần như cùng lúc,
cả 2 đều tính `0+15=15` (hợp lệ), cả 2 đều `save()` — request nào `save()`
sau sẽ **ghi đè** giá trị của request trước (không cộng dồn), kết quả cuối
`total_hours=15` dù thực tế có 2 dòng `log_works` × 15h = 30h đã ghi — bảng
tổng hợp và bảng chi tiết lệch nhau, đúng lỗi "silent data corruption" đã
cảnh báo ở lý thuyết. **Không tái hiện lại kịch bản lỗi này bằng code thật**
trong lần test này (không rollback code để test cái sai) — chỉ ghi lại lý do
tin rằng nó sẽ xảy ra, dựa trên cơ chế Isolation của transaction đã học.

### Xác nhận trạng thái cuối cùng — không mất dữ liệu, không double-count

```bash
python manage.py shell -c "
from timesheets.models import DailyUserTimesheet, LogWork
d = DailyUserTimesheet.objects.get(user_id=3, work_date='2026-07-20')
print('total_hours =', d.total_hours)
print('so dong log_works:', LogWork.objects.filter(user_id=3, work_date='2026-07-20').count())
"
```
```text
total_hours = 15.00
so dong log_works: 1
```

✅ Đúng — chỉ 1 dòng `log_works` (request A), `total_hours` khớp đúng 15,
không có dòng rác nào từ request B.

## Bảng tổng hợp kết quả

| # | Trường hợp | Status mong đợi | Status thực tế | Kết quả |
|---|---|---|---|---|
| 1 | Log 5h, tích lũy bình thường | 201 | 201 | ✅ |
| 2 | Log thêm 18h, tổng 23h | 201 | 201 | ✅ |
| 3 | Log thêm 5h, tổng 28h > 24h | 400 (+ rollback sạch) | 400 (+ rollback sạch, xác nhận qua DB) | ✅ |
| 4 | Race condition: 2 request song song, mỗi cái 15h | 1 thành công + 1 bị chặn, tổng đúng | 1×201 + 1×400, `total_hours=15` | ✅ |

**Giai đoạn 2 (24h Cap + Race Condition) hoàn tất** — 4/4 test case đúng kỳ
vọng, bao gồm 1 test race condition bằng request đồng thời thật (không phải
mô phỏng).

## Việc KHÔNG làm trong Giai đoạn 2 này (để khỏi lan phạm vi)

- Time Lock check (Lớp phòng thủ 1) — thuộc Giai đoạn 4, cần Giai đoạn 3
  (API Time Lock) làm trước.
- API Time Lock (chốt sổ kỳ báo cáo) — Giai đoạn 3.
- Sửa/xóa `log_work` — Giai đoạn 6 (Edge cases).
