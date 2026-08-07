# 03 — Luồng Log Work (Chấm công) end-to-end

## Sơ đồ tổng thể

```text
[1] FE: Nhân viên chọn Task, nhập work_date + hours_spent + description
       (react-hook-form validate: hours_spent > 0, work_date không bỏ trống)
       ↓
[2] FE: Submit → disable nút ngay (chống Double Submit, xem file 06)
       ↓
[3] FE: POST /api/timesheets/log-work/  { task_id, work_date, hours_spent, description }
       ↓
[4] BE: mở transaction.atomic()
       ↓
[5] BE — Lớp phòng thủ 1 (Time Lock):
       SELECT is_locked FROM time_locks
       WHERE lock_month = MONTH(work_date) AND lock_year = YEAR(work_date)
       → is_locked = True?  → raise ValidationError, HTTP 403, DỪNG Ở ĐÂY
       ↓ (chưa khóa, hoặc chưa có dòng time_lock cho kỳ này = coi như chưa khóa)
[6] BE — Lớp phòng thủ 2 (Pessimistic Locking + Daily Cap):
       SELECT total_hours FROM daily_user_timesheets
       WHERE user_id = request.user.id AND work_date = work_date
       FOR UPDATE   (nếu chưa có dòng nào, tạo mới với total_hours=0)
       ↓
       total_hours_moi = total_hours_cu + hours_spent
       total_hours_moi > 24?  → raise ValidationError, HTTP 400, ROLLBACK
       ↓ (hợp lệ)
[7] BE: UPDATE daily_user_timesheets SET total_hours = total_hours_moi
       ↓
[8] BE: INSERT INTO log_works (task_id, user_id, work_date, hours_spent, description)
       ↓
[9] BE: COMMIT transaction
       ↓
[10] BE: trả 201 Created, kèm dữ liệu log_work vừa tạo
       ↓
[11] FE: hiện toast thành công, bật lại nút Submit, cập nhật UI (tổng giờ hôm nay)
```

## Vì sao bước [4] mở transaction TRƯỚC cả bước kiểm tra Time Lock (bước 5)?

Có thể bạn nghĩ: "kiểm tra Time Lock chỉ là SELECT, không cần transaction".
Đúng là riêng bước 5 không bắt buộc transaction. Nhưng vì bước 6-8 (đọc-tính-
ghi) bắt buộc phải nằm trong **cùng một transaction** với nhau (để
`FOR UPDATE` có hiệu lực giữ khóa xuyên suốt tới lúc `COMMIT`), cách viết code
gọn nhất là mở transaction bao trùm toàn bộ hàm xử lý — kiểm tra sớm
(bước 5) bên trong transaction đó để **nếu fail, có thể return/raise ngay,
Django tự rollback transaction rỗng** (không tốn gì, vì chưa ghi gì cả).

## Điều gì xảy ra khi `time_locks` CHƯA có dòng nào cho kỳ đó

Đây là một edge case dễ bị bỏ sót: tháng hiện tại (ví dụ tháng 6/2026) chưa
được Admin/Manager chốt sổ — nghĩa là **không tồn tại dòng `time_locks` với
`lock_month=6, lock_year=2026`**. Câu `SELECT is_locked FROM time_locks
WHERE ...` sẽ trả về **rỗng**, không phải `False`. Code phải xử lý: "không
tìm thấy dòng time_lock" = "chưa từng bị khóa" = cho phép log work bình
thường. Đây là lý do nên dùng `TimeLock.objects.filter(...).first()` rồi
check `if lock and lock.is_locked`, không nên dùng `.get()` (sẽ ném
`DoesNotExist` exception nếu chưa có dòng, dễ bị code crash nếu không bắt
exception đó).

## Vì sao bảng `daily_user_timesheets` "tự tạo dòng mới" ở bước [6]

`DailyUserTimesheet` có composite primary key `(user, work_date)` — nghĩa là
mỗi (nhân viên, ngày) chỉ có đúng 1 dòng tổng hợp. Lần đầu nhân viên log giờ
trong 1 ngày mới, dòng này chưa tồn tại — cần `get_or_create()` trước khi
`select_for_update()`. Thứ tự đúng:

```text
get_or_create(user=X, work_date=Y, defaults={"total_hours": 0})
→ rồi mới select_for_update() trên dòng vừa lấy/tạo đó
```

## Vì sao trả lỗi 403 cho Time Lock nhưng 400 cho vượt 24h (khác mã lỗi)

Cùng nguyên tắc đã nói ở `auth-guide` (file 03): mã lỗi phải phản ánh đúng
**loại** vấn đề.

- **403 Forbidden** (Time Lock): dữ liệu nhập có thể hoàn toàn hợp lệ về số
  liệu (ví dụ chỉ 2 giờ, không vượt 24h) — nhưng bị cấm vì **lý do hành
  chính** (kỳ đã chốt sổ). Nhân viên không thể "sửa lại form" để qua được
  lỗi này — họ phải liên hệ Manager mở khóa.
- **400 Bad Request** (vượt 24h): lỗi do **chính dữ liệu nhập vào** không
  hợp lệ. Nhân viên có thể tự sửa số giờ thấp hơn để submit lại thành công.

Phân biệt rõ điều này giúp Frontend hiển thị 2 loại thông báo khác nhau:
"Kỳ báo cáo đã đóng, vui lòng liên hệ Quản lý" vs "Bạn đã nhập quá 24 giờ
hôm nay, vui lòng kiểm tra lại".

## Câu hỏi tự kiểm tra

1. Nếu nhân viên log work cho `work_date` là 1 ngày trong tháng trước (đã
   qua), nhưng tháng đó **chưa từng bị khóa**, hệ thống có cho phép không?
   Đây có phải lỗ hổng nghiệp vụ không? (Gợi ý: nghĩ xem ai chịu trách nhiệm
   khóa kỳ báo cáo, và họ có làm đúng lúc không phải lúc nào cũng đảm bảo).
2. Bước [6] dùng `FOR UPDATE` khóa dòng `daily_user_timesheets`. Nếu 2 nhân
   viên KHÁC NHAU cùng log work cùng lúc (mỗi người cho `work_date` của
   chính họ), 2 request này có chặn nhau không? Vì sao?
