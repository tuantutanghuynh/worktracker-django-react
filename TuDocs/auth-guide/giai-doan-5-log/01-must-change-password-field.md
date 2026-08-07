# 01 — Field `must_change_password`

## Vì sao `default=True`

Khi Minh Anh tự tạo user mới trong `views_admin.py` của cô ấy (theo mô
hình "app dùng chung" đã áp dụng), cô ấy cấp password mặc định cho nhân
viên — field này phải tự động là `True` ngay khi tạo, không cần cô ấy nhớ
set tay mỗi lần.

## Code cuối cùng — `backend/accounts/models.py`, trong `CustomUser`

```python
class CustomUser(AbstractUser):
    ...
    # Trường is_active đã được định nghĩa sẵn trong AbstractUser với cơ chế chuyển FALSE khi nghỉ việc
    must_change_password = models.BooleanField(
        default=True
    )  # Cờ buộc đổi mật khẩu lần đầu đăng nhập hoặc sau khi reset
```

## Migration — `backend/accounts/migrations/0004_customuser_must_change_password.py`

```python
class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_add_employee_view_permission'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='must_change_password',
            field=models.BooleanField(default=True),
        ),
    ]
```

## ⚠️ Hệ quả thật đã xảy ra: `default=True` áp dụng luôn cho user cũ

3 tài khoản test đã tồn tại từ trước (`admin@worktracker.com`,
`manager@worktracker.com`, `employee@worktracker.com`) đều tự động chuyển
thành `must_change_password=True` ngay sau khi `migrate` — không phải chỉ
user tạo *sau* migration mới bị vậy. Đây là hành vi đúng của Django (mọi
dòng cũ thiếu giá trị cho field mới sẽ nhận `default`), không phải bug —
nhưng cần biết trước để không bất ngờ khi 3 tài khoản test "tự nhiên" bị
chặn gọi API ở bước sau.

Thực tế hệ quả này lại **có lợi** — tận dụng đúng 3 tài khoản này để test
toàn luồng ở Bước 5 (Giai đoạn 5) mà không cần tạo thêm data mới.

## Bug thật đã gặp: ký tự lạ `ß` lẫn vào file — lớp lỗi mới, khác mọi lỗi trước

Lần đầu chạy `makemigrations`, Django báo lỗi khi *import* file
`models.py` (trước cả khi kịp so sánh model có gì thay đổi):

```text
File "accounts/models.py", line 71, in <module>
    ß
NameError: name 'ß' is not defined
```

Một ký tự `ß` (chữ "ess-zett" của tiếng Đức) đứng riêng 1 dòng, ngay sau
`def __str__(self): return self.email` của `CustomUser`. Khả năng cao do
gõ nhầm tổ hợp phím Option trên bàn phím Mac (`Option + S` tạo ra `ß`) khi
tay đang ở gần phím Option, lỡ chạm phải.

### Vì sao Python coi đây là lỗi nghiêm trọng (crash ngay), không phải cảnh báo

Một dòng chỉ có 1 token đứng riêng (`ß`) được Python hiểu là **một câu
lệnh dạng biểu thức** (expression statement) — giống như gõ `x` một mình
trên 1 dòng. Python thử "đánh giá" biểu thức đó, tức tìm biến tên `ß` đã
từng được định nghĩa chưa — không thấy, nên ném `NameError`. Vì lỗi xảy ra
ngay ở **mức import module** (Django phải `import models.py` để biết cấu
trúc app trước khi làm bất cứ điều gì khác), nó chặn đứng toàn bộ
`makemigrations`/`migrate`/`runserver`, không chỉ riêng phần code liên
quan tới `must_change_password`.

### Cách phát hiện

Đọc kỹ traceback — dòng cuối luôn chỉ thẳng số dòng và nội dung gây lỗi
(`models.py`, line 71, in `<module>`, rồi chính ký tự `ß`). Không cần đoán
— traceback của Python luôn nói rõ chỗ sai, chỉ cần đọc hết, không dừng ở
dòng `NameError` đầu tiên.

### Cách sửa

Xóa hẳn dòng chứa `ß`, không thay bằng gì cả (nó không phải code hợp lệ,
chỉ là ký tự lạc vào do gõ nhầm).
