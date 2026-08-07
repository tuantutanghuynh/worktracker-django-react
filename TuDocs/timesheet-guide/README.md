# Timesheet Guide — Lộ trình tư duy trước khi viết code

Series này dành cho Tuấn Tú (phụ trách app `timesheets`: chấm công Log Work,
chốt sổ kỳ báo cáo) trong dự án WorkTracker. Đây là phần việc thứ 2 của bạn,
song song với app `accounts` (xem series [auth-guide](../auth-guide/)).

Khác với `accounts`, phần `timesheets` không nặng về khái niệm bảo mật mà
nặng về **tính đúng đắn dữ liệu khi nhiều người/nhiều request cùng ghi vào
một dòng** (concurrency) — đây là dạng bài toán khác hẳn, và là lý do tài
liệu yêu cầu gọi đây là *"bộ lọc thép"*.

## Vì sao module này khó hơn vẻ ngoài của nó

Nhìn lướt qua, "nhập số giờ làm việc" trông giống một form CRUD bình thường.
Nhưng yêu cầu thực tế ẩn chứa 2 bài toán kỹ thuật khó:

1. **Race Condition**: nếu nhân viên mở 2 tab, hoặc mạng lag bấm Submit 2
   lần, 2 request "cùng đọc tổng giờ cũ, cùng cộng thêm, cùng ghi" có thể
   đọc sai dữ liệu của nhau và **vượt qua được giới hạn 24h/ngày dù mỗi
   request riêng lẻ đều hợp lệ**.
2. **Bảo vệ dữ liệu lương đã chốt sổ**: một khi Manager/Admin đã "khóa" một
   kỳ báo cáo, dữ liệu trong kỳ đó dùng để tính lương — nếu nhân viên sửa
   được sau khi khóa, số liệu lương sai mà không ai biết.

## Thứ tự đọc

| # | File | Trả lời câu hỏi |
|---|------|------------------|
| 1 | [01-mental-model.md](01-mental-model.md) | Vấn đề nghiệp vụ thật sự là gì? Vì sao gọi đây là "Defensive Database Programming"? |
| 2 | [02-race-condition-and-transactions.md](02-race-condition-and-transactions.md) | Race Condition cụ thể xảy ra thế nào? Transaction, ACID, Pessimistic Locking (`SELECT FOR UPDATE`) giải quyết ra sao? |
| 3 | [03-log-work-flow.md](03-log-work-flow.md) | Luồng "chấm công" đi từng bước nào từ Frontend tới Database? |
| 4 | [04-time-lock-flow.md](04-time-lock-flow.md) | Luồng "chốt sổ kỳ báo cáo" hoạt động ra sao, và nó chặn nhân viên ở đâu? |
| 5 | [05-data-integrity-and-schema.md](05-data-integrity-and-schema.md) | Vì sao dùng `DECIMAL` không dùng `FLOAT`? Vì sao có cả `log_works` và `daily_user_timesheets` — không gộp 1 bảng được sao? |
| 6 | [06-frontend-architecture.md](06-frontend-architecture.md) | Form nhập giờ, chặn Double Submit, bộ lọc theo khoảng ngày — tổ chức phía React thế nào? |
| 7 | [07-security-and-edge-cases.md](07-security-and-edge-cases.md) | Các trường hợp biên dễ bị bỏ sót khi code (sửa log cũ, xóa Task có log, nhập giờ cho ngày tương lai...) |
| 8 | [08-roadmap-and-talking-points.md](08-roadmap-and-talking-points.md) | Checklist, thứ tự code hợp lý, script trình bày với team |

## Nguồn tài liệu đã đối chiếu

- `docs/DATABASE_WORKTRACKER (FIXED).docx` — mục "🛡️ Cơ chế Phòng thủ Bảng
  Log Work (Defensive Database Programming)" — đây là tài liệu nặng nhất,
  mô tả chính xác thuật toán 3 bước bạn phải cài đặt.
- `docs/all worktracker features-fix.docx` — mục "Trạm ghi nhận Thời gian
  (Log Work / Timesheet Station)" (phía Employee) và "Đánh giá Báo cáo & Khóa
  Log Work" (phía Manager).
- `backend/timesheets/models.py` — đã có sẵn 3 model (`TimeLock`, `LogWork`,
  `DailyUserTimesheet`). Series này giải thích **logic/API sẽ xây trên nền
  đó**, không lặp lại phần model.

## Lưu ý

Giống series `auth-guide`, các file ở đây không chứa code implementation
hoàn chỉnh — chỉ pseudocode để hiểu ý tưởng. Khi nắm chắc, quay lại nhờ tôi
code thật theo roadmap ở file 08.
