# 06 — Kiến trúc Frontend cho Log Work & Timesheet Review

## Vấn đề Double Submit — vì sao đây là vấn đề riêng của module này

Mọi form trên web đều có thể bị bấm Submit 2 lần do mạng lag, nhưng ở hầu
hết module (ví dụ tạo Client), hậu quả chỉ là tạo trùng 1 dòng dữ liệu —
khó chịu nhưng dễ dọn (Admin xóa dòng trùng). Ở Log Work, hậu quả khác hẳn:
nếu Double Submit "lách" qua được race condition (xem file 02), nó **trực
tiếp tạo ra dữ liệu lương sai sự thật**, và nếu backend đã code đúng
Pessimistic Locking, double submit ở Frontend tệ nhất chỉ tạo ra **2 dòng
log_work hợp lệ riêng biệt** (mỗi dòng đúng số giờ nhập) — nhưng người dùng
không cố ý log 2 lần, nên đây vẫn là 1 bug UX cần chặn ở Frontend, dù
Backend đã có lưới an toàn.

```text
Bấm Submit lần 1 ──► request đang bay (network lag, 1-2 giây)
Người dùng tưởng chưa gửi ──► bấm Submit lần 2
       ↓
Backend nhận 2 request riêng biệt, đều hợp lệ (Backend không biết đây là
"vô tình 2 lần" hay "2 lần log work thật")
       ↓
Kết quả: 2 dòng log_work, tổng giờ bị nhân đôi
```

Giải pháp đúng theo tài liệu: *"Nút Submit phải được thiết lập trạng thái
loading (disable) ngay khi bấm"*.

```text
[1] onSubmit() chạy
       ↓
[2] setLoading(true)  →  disable nút Submit NGAY (đồng bộ, trước khi gọi API)
       ↓
[3] await axios.post('/api/timesheets/log-work/', data)
       ↓
[4] finally: setLoading(false)  →  bật lại nút (dù thành công hay lỗi)
```

Điểm quan trọng: bước [2] phải chạy **ngay lập tức, đồng bộ** — không chờ
response API rồi mới disable, vì như vậy vẫn còn khoảng hở để bấm 2 lần.

## Vì sao chỉ disable nút là chưa đủ trong mọi trường hợp (kiến thức mở rộng)

Disable nút giải quyết được trường hợp người dùng tự bấm 2 lần bằng tay.
Nhưng nó **không giải quyết được** trường hợp: trình duyệt tự động gửi lại
request khi mất mạng giữa đường rồi có mạng lại (một số thư viện HTTP retry
tự động), hoặc người dùng dùng tool gửi request thủ công (Postman) gửi 2
request giống nhau rất nhanh. Đây là lý do **Backend không được dựa vào việc
Frontend đã disable nút để coi là an toàn** — đúng tinh thần "không tin
tưởng Frontend" đã nói ở file 01. Disable nút là tối ưu UX (giảm khả năng
xảy ra), Pessimistic Locking ở Backend là đảm bảo đúng dữ liệu (xử lý khi nó
vẫn xảy ra).

## Form Log Work — các trường và validate phía Frontend

```text
Task         — select, bắt buộc (chỉ hiện Task đang giao cho nhân viên này)
work_date    — date picker, bắt buộc, không cho chọn ngày trong TƯƠNG LAI
               (nghiệp vụ: log giờ đã làm, không log giờ "sẽ làm")
hours_spent  — number, bắt buộc, > 0, nên giới hạn input tối đa hợp lý
               (ví dụ max 24 ngay trên UI — nhưng đây chỉ là gợi ý UX,
               Backend vẫn phải tự kiểm tra tổng tích lũy, không phải
               chỉ kiểm tra số nhập 1 lần có <= 24 hay không)
description  — textarea, không bắt buộc
```

Validate bằng `react-hook-form` + `zod`, theo đúng pattern đã dùng ở module
khác trong dự án (`all worktracker features-fix.docx` nhắc tới cặp thư viện
này ở nhiều trang form).

## Hiển thị lỗi đúng loại (khớp với 2 mã lỗi ở file 03)

```text
Backend trả 403 (Time Lock)  → FE hiện:
  "Kỳ báo cáo tháng X đã được chốt sổ. Vui lòng liên hệ Quản lý nếu cần điều chỉnh."

Backend trả 400 (vượt 24h)   → FE hiện:
  "Tổng số giờ trong ngày vượt quá 24 giờ. Bạn đã log Y giờ, chỉ có thể nhập thêm Z giờ nữa."
```

Để hiện được message "đã log Y giờ" cụ thể, Backend nên trả kèm dữ liệu phụ
trong response lỗi (ví dụ `{"error": "...", "current_total": 22, "max_allowed": 2}`)
— đây là điểm bạn nên thảo luận với Backend (chính bạn) khi thiết kế response
lỗi, không chỉ trả 1 câu message chung.

## Trang Timesheet Review (phía Manager) — bộ lọc theo khoảng ngày

Theo `all worktracker features-fix.docx`: *"Cung cấp giao diện lọc dữ liệu
(Filter by Date Range, Filter by Employee)"*.

```text
GET /api/timesheets/log-work/?employee_id=5&date_from=2026-05-01&date_to=2026-05-31
```

Dùng `TanStack Table` (đã dùng ở các module khác trong dự án) để hiển thị —
nhất quán component giữa các trang giúp cả team dùng chung 1 cách làm bảng
dữ liệu, dễ review code cho nhau.

**Nhắc lại Data Isolation (auth-guide file 04)**: API này phải tự filter
theo `manager=request.user` ở tầng Backend (chỉ thấy nhân viên thuộc team
mình), Manager không được tùy ý truyền `employee_id` của nhân viên team khác
và lấy được dữ liệu — dù Frontend chỉ hiển thị dropdown nhân viên trong team
mình, Backend vẫn phải tự kiểm tra độc lập.

## Câu hỏi tự kiểm tra

1. Vì sao chặn chọn ngày tương lai ở `work_date` lại là validate UX (Frontend)
   chứ không cần Backend tự chặn nghiêm ngặt như Time Lock hay 24h-cap? (Gợi
   ý: nghĩ về hậu quả nếu lỡ "lọt" qua được — có gây sai lương hay sai dữ
   liệu nghiêm trọng như 2 trường hợp kia không?)
2. Nút "Chốt báo cáo" (Time Lock) phía Manager có cần cơ chế chống Double
   Submit giống nút Log Work của Employee không? Hậu quả nếu Manager bấm
   nhầm nút này 2 lần là gì, nghiêm trọng hơn hay nhẹ hơn so với Double
   Submit ở Log Work?
