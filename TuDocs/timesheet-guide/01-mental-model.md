# 01 — Mental Model: Vì sao Log Work là "Defensive Database Programming"

## Vấn đề nghiệp vụ thật, không phải vấn đề kỹ thuật

Trước khi nói tới code, hãy hiểu bảng `log_works` dùng để làm gì trong đời
thực: đây là dữ liệu **đầu vào để tính lương** nhân viên. Nếu một nhân viên
khai man giờ làm (cố ý hoặc do lỗi phần mềm cho phép nhập sai), công ty trả
lương sai — đây không phải lỗi UI khó chịu, mà là **thiệt hại tài chính
thật**. Đây là lý do tài liệu dùng từ rất mạnh:

> "Trong thiết kế hệ thống, nguyên tắc tối thượng là: Không bao giờ được tin
> tưởng tuyệt đối vào Frontend hay người dùng."

## "Defensive Programming" nghĩa là gì, khác gì với code validate thông thường

Validate thông thường (mà bạn đã quen, ví dụ ở `accounts`): kiểm tra định
dạng dữ liệu — email đúng format, password đủ độ dài. Đây là kiểm tra
**dữ liệu của 1 request, độc lập với các request khác**.

Defensive Programming ở đây khác về bản chất: phải kiểm tra **dữ liệu của
request này so với trạng thái tích lũy từ TẤT CẢ các request trước đó của
cùng 1 người, trong cùng 1 ngày** — và quan trọng hơn, phải đúng cả khi
**nhiều request đến gần như đồng thời**. Đây là lý do nó khó hơn validate
thông thường rất nhiều, và là lý do file 02 dành riêng để nói về Race
Condition.

## 2 lớp phòng thủ, không phải 1

Đọc kỹ yêu cầu, có **2 điều kiện** phải chặn, không phải 1:

```text
Lớp 1 — Chặn theo THỜI GIAN (Time Lock):
  Ngày nhập có rơi vào kỳ báo cáo đã bị khóa không?
  → Nếu khóa rồi: chặn tuyệt đối, không phân biệt giờ nhập bao nhiêu.

Lớp 2 — Chặn theo TỔNG SỐ (Daily Hours Cap):
  Tổng giờ đã log trong ngày + giờ chuẩn bị nhập có vượt 24h không?
  → Nếu vượt: chặn, vì 1 ngày không thể có hơn 24 giờ vật lý.
```

Hai lớp này độc lập với nhau và phải kiểm tra **theo đúng thứ tự** — Lớp 1
trước, Lớp 2 sau. Lý do thứ tự này quan trọng: nếu kỳ đã khóa, không cần
tốn công tính tổng giờ (Lớp 2) — dừng sớm tiết kiệm tài nguyên, và về mặt
nghiệp vụ, "kỳ đã khóa" là một lý do chặn dứt khoát hơn (không có ngoại lệ),
còn "vượt 24h" chỉ tính khi kỳ chưa khóa.

## "Database Trigger" được nhắc tới — bạn có cần dùng không?

Tài liệu nhắc tới một lựa chọn kỹ thuật khác:

> "Thay vì chỉ dựa vào tầng logic code Django dễ bị vượt mặt, các hệ thống
> quản trị quy mô lớn sẽ triển khai Database Trigger (Trình kích hoạt dữ
> liệu) chốt chặn ngay bên trong lõi MySQL/Postgres."

Đây là kiến thức nên **biết để hiểu trade-off**, không nhất thiết phải làm
ngay ở giai đoạn đầu:

| | Chặn ở tầng Django (Serializer/Transaction) | Chặn ở tầng Database (Trigger) |
|---|---|---|
| Ai có thể "lách" qua được? | Ai chạy raw SQL trực tiếp vào DB (admin tool, script seed data lỗi) | Không ai lách được — Database tự chặn mọi đường ghi dữ liệu, kể cả khi không qua Django |
| Dễ đọc / dễ debug | Dễ — code Python, đọc traceback rõ ràng | Khó hơn — logic nằm trong PL/pgSQL, ít người quen, khó test |
| Tốc độ phát triển | Nhanh, linh hoạt sửa đổi | Chậm hơn, mỗi lần sửa logic phải migrate trigger |

Tài liệu mô tả thuật toán cụ thể ("Thuật toán chặn dữ liệu ngược") **được áp
dụng tại Backend Transaction** — nghĩa là yêu cầu thực tế của dự án chọn cách
làm ở tầng Django, không bắt buộc viết Database Trigger thật. Phần "Trigger"
chỉ là kiến thức nền để bạn hiểu vì sao tầng Database (qua `CheckConstraint`
mà bạn đã thấy trong `DailyUserTimesheet.Meta.constraints`) vẫn được giữ làm
**lớp phòng thủ cuối cùng** — một tấm lưới an toàn nếu tầng Django lỡ có bug.

## Liên hệ với `CheckConstraint` đã có sẵn trong model

Nhìn lại `backend/timesheets/models.py`:

```python
class DailyUserTimesheet(models.Model):
    ...
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'work_date'], ...),
            models.CheckConstraint(condition=models.Q(total_hours__lte=24), ...)
        ]
```

`CheckConstraint(total_hours__lte=24)` chính là **lớp phòng thủ tầng
Database** đã được thiết kế sẵn — nếu code Django ở tầng Serializer (lớp
phòng thủ tầng Application) có bug và cố `UPDATE` ra số > 24, Postgres sẽ tự
**từ chối câu lệnh đó và ném lỗi**, dù Django "tưởng" mình đã tính đúng. Đây
là minh chứng thực tế cho nguyên tắc "không tin tưởng tuyệt đối vào 1 tầng
duy nhất" — áp dụng 2 lớp độc lập, lớp sau bắt lỗi của lớp trước.

## Câu hỏi tự kiểm tra

1. Vì sao tài liệu yêu cầu kiểm tra Time Lock **trước** khi kiểm tra tổng giờ
   24h, không phải ngược lại?
2. `CheckConstraint` ở tầng Database có biết được "kỳ báo cáo có bị khóa
   hay không" không? Tại sao có/không? (Gợi ý: nhìn lại field nào nằm trong
   bảng nào).
