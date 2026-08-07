# Giai đoạn 2 — Lớp phòng thủ 2 (Daily 24h Cap + Race Condition): Tổng quan

Bản ghi lại quá trình triển khai **Giai đoạn 2** trong roadmap ở
`timesheet-guide/08-roadmap-and-talking-points.md`, nối tiếp
[giai-doan-1-log](../giai-doan-1-log/). Lý thuyết nền cho giai đoạn này đã
học kỹ ở `timesheet-guide/02-race-condition-and-transactions.md` và
`timesheet-guide/03-log-work-flow.md` — series log này chỉ ghi lại phần
**đã code thật + test thật**, không lặp lại lý thuyết.

## Phạm vi đã hoàn thành

Thêm Pessimistic Locking (`select_for_update()`) + kiểm tra tổng giờ/ngày
vào `EmployeeLogWorkSerializer.create()` — **chưa** đụng tới Time Lock (Lớp
phòng thủ 1, thuộc Giai đoạn 4).

- Mỗi lần tạo `log_work`, tự động cập nhật dòng tổng hợp tương ứng trong
  `daily_user_timesheets` (tạo mới nếu chưa có).
- Toàn bộ thao tác (đọc-tính-ghi `daily_user_timesheets` + ghi `log_works`)
  nằm trong 1 `transaction.atomic()` duy nhất — vượt 24h thì rollback sạch,
  không để lại dữ liệu nửa vời.
- Xác nhận bằng test thật: 2 request đồng thời (không phải giả lập) chạm
  đúng race condition đã phân tích ở file `02`, và hệ thống xử lý đúng.

## Cây file đã sửa

```text
backend/timesheets/serializers_employee.py   ← sửa: create() thêm
                                                 transaction.atomic() +
                                                 select_for_update() +
                                                 kiểm tra 24h-cap
```

Không đụng tới `views_employee.py` hay `urls_employee.py` — toàn bộ thay
đổi nằm gọn trong Serializer, đúng nguyên tắc "Serializer lo nghiệp vụ" đã
thiết lập từ Giai đoạn 1.

## Phát hiện quan trọng trước khi code: dự án dùng Postgres thật, không phải SQLite

Kiểm tra `worktracker_core/settings.py` xác nhận `DATABASES.ENGINE =
'django.db.backends.postgresql'` — file `db.sqlite3` nằm trong `backend/`
chỉ là rác cũ từ lúc `django-admin startproject`, không được dùng. Điều này
quan trọng vì `select_for_update()` chỉ có tác dụng khóa dòng thật trên
Postgres/MySQL — trên SQLite, Django coi `has_select_for_update = False` và
âm thầm bỏ qua mệnh đề khóa (không lỗi, nhưng cũng không khóa gì cả). Nếu dự
án lỡ chạy trên SQLite, test race condition ở file `02` có thể "tình cờ
đúng" nhờ SQLite tự khóa ghi ở cấp toàn database, khiến người test lầm tưởng
code đã đúng trong khi thực ra chưa từng chạm tới `FOR UPDATE` thật.

## Thứ tự đọc

| # | File | Nội dung |
|---|------|----------|
| 1 | [01-pessimistic-locking-implementation.md](01-pessimistic-locking-implementation.md) | Code cuối cùng của `create()`, lý do từng dòng, bug `Decimal`/`float` |
| 2 | [02-testing-va-ket-qua.md](02-testing-va-ket-qua.md) | 4 test case thật, bao gồm test race condition bằng 2 request `curl` chạy song song thật sự |

## Nguyên tắc đáng nhớ nhất để trình bày với team

1. **`get_or_create()` rồi mới `select_for_update()`** — không gộp làm 1
   bước, vì 2 hàm giải quyết 2 vấn đề khác nhau (đảm bảo dòng tồn tại vs.
   khóa dòng để tính toán an toàn).
2. **Toàn bộ đọc-tính-ghi nằm trong 1 `transaction.atomic()`** — vượt 24h
   thì exception bay ra khỏi khối `with`, Django tự rollback, không cần tự
   viết logic hoàn tác tay.
3. **`Decimal`, không phải `float`, cho dữ liệu tiền lương/giờ công** — trộn
   2 kiểu số này trong Python ném `TypeError` ngay lập tức (khác Java, nơi
   `int`/`double` tự ép kiểu ngầm) — một dạng bảo vệ "fail fast" hữu ích chứ
   không chỉ là rắc rối.
4. **Test race condition phải dùng request đồng thời THẬT** (2 tiến trình
   `curl` chạy song song, không phải gọi tuần tự nhanh) — mới thật sự kiểm
   chứng được `FOR UPDATE` có hoạt động hay không.
