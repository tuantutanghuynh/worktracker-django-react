# 05 — Script nói chuyện với Đức Long: Celery đã sẵn sàng cho `.delay()`

Dùng để báo Đức Long ngay khi gặp (chat/họp nhanh), không cần đợi tới buổi
họp Chủ Nhật. Mục tiêu: anh ấy biết hạ tầng đã có, cách chạy nó khi dev, và
không cần tự viết gì thêm ở phía Celery — chỉ cần gọi đúng `notify()` với
`channel` phù hợp trong code review Task/LogWork của anh ấy.

---

## Phần 1 — Báo đã xong (mở đầu)

> "Long ơi, Celery mình vừa dựng xong và test end-to-end rồi — cái cậu cần
> để gửi email khi duyệt/từ chối Task/LogWork đó. Cậu không cần tự cài gì
> cả, chỉ cần `git pull` nhánh mới, `pip install -r requirements.txt` lại
> (mình vừa thêm `celery==5.6.3`), là dùng được luôn."

## Phần 2 — Cách chạy khi dev (thao tác cụ thể)

> "Khi dev, cậu cần chạy **2 tiến trình song song** trong 2 terminal khác
> nhau, giống `runserver` với `celery worker` là 2 thứ tách biệt:
>
> ```bash
> # Terminal 1 — như bình thường
> python manage.py runserver
>
> # Terminal 2 — mới, cần thêm khi muốn test phần gửi email
> celery -A worktracker_core worker --loglevel=info
> ```
>
> Nếu quên chạy Terminal 2, code vẫn chạy bình thường, không lỗi gì cả —
> chỉ là notification vẫn lưu DB đúng nhưng email sẽ không gửi (task nằm
> chờ trong Redis, worker chạy lên lúc nào thì xử lý lúc đó). Nên nếu đang
> test tính năng cần thấy email, nhớ bật cả 2 terminal."

## Phần 3 — Cậu không cần viết gì thêm ở phía Celery

> "Điểm quan trọng nhất: cậu **không cần tự gọi `.delay()`** hay tự import
> gì từ `system/tasks.py` cả — mình đã nối sẵn vào đúng chỗ `notify()` rồi.
> Cậu chỉ cần gọi `notify()` như bình thường (hàm này Long/Minh Anh đã viết
> sẵn ở `system/services/notification_manager_service.py`), miễn nhớ 1
> điều: muốn có email thật thì phải truyền `channel=EMAIL_ONLY` hoặc
> `channel=ALL`, không phải mặc định `SYSTEM_ONLY`:
>
> ```python
> notify(
>     recipients=[employee],
>     event_type="LOG_WORK_APPROVED",   # hoặc REJECTED/VOIDED, đã có sẵn 3 type này
>     title="Log work của bạn đã được duyệt",
>     channel=Notification.ChannelType.EMAIL_ONLY,  # hoặc ALL nếu vừa muốn lưu DB vừa gửi email
> )
> ```
>
> `SYSTEM_ONLY` (mặc định) chỉ lưu vào bảng `notifications`, không kích
> hoạt task gửi mail nào — nếu review flow của cậu gọi `notify()` mà không
> thấy email, kiểm tra lại đúng `channel` trước."

## Phần 4 — Giới hạn hiện tại, cần biết trước khi demo/deploy

> "Vài điểm còn thiếu, chưa phải bug nhưng cậu nên biết:
>
> 1. Email hiện đang dùng **console backend** (`EMAIL_BACKEND` trong
>    `settings.py`) — nghĩa là 'email' chỉ in ra terminal đang chạy
>    `celery worker`, không gửi thật ra ngoài. Trước khi demo cho khách/thầy
>    cô cần email thật, phải đổi qua SMTP thật (mình sẽ làm khi cần, hoặc
>    báo mình sớm nếu cậu cần trước).
> 2. Retry khi SMTP lỗi tạm thời (`autoretry_for`) mình mới cấu hình, chưa
>    test thật case retry (cần giả lập lỗi mạng thật để test) — chỉ mới
>    xác nhận happy path (gửi thành công) chạy đúng.
> 3. Nếu worker đang chạy mà tụi mình sửa code trong `system/tasks.py`,
>    phải tắt (Ctrl+C) và chạy lại lệnh `celery worker` — nó không tự nhận
>    code mới như `runserver` (không có auto-reload)."

## Phần 5 — Chốt lại

> "Tóm lại: hạ tầng đã sẵn sàng, cậu chỉ cần `pull` code + cài lại
> requirements, nhớ bật `celery worker` song song `runserver` khi test, và
> gọi đúng `channel=EMAIL_ONLY`/`ALL` trong `notify()`. Có gì lạ (task
> không chạy, email không thấy) cứ hỏi mình, khả năng cao là quên bật
> worker hoặc quên restart nó sau khi có code mới."
