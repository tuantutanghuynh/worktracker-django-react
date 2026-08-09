# Hướng Dẫn Cài Đặt & Đồng Bộ Dự Án WorkTracker (Dành cho Team)

Tài liệu này hướng dẫn các thành viên trong nhóm cách kéo code mới nhất từ GitHub về, cài đặt môi trường và đồng bộ Database để code chạy mượt mà mà không gặp lỗi thiếu thư viện hay thiếu bảng dữ liệu.

---

# Bước 1: Kéo code mới nhất từ GitHub

Pull, merge code các nhánh của nhóm khác về (thay `main` bằng tên nhánh mà team đang làm việc nếu cần).

```bash
git pull origin main
```

---

# Bước 2: Active môi trường thư mục backend

```bash
.venv\Scripts\activate
```

---

# Bước 3: Cài đặt các thư viện trong requirements

```bash
cd backend
pip install -r requirements.txt
```

---

# Bước 4: Đồng bộ Database

Chú ý nếu nhóm khác có sửa model thì merge migration bằng lệnh:

```bash
python manage.py makemigrations --merge
```

Sau đó chạy:

```bash
python manage.py migrate
```

---

# Bước 5: Thêm dữ liệu mẫu permissions của Manager vao database

Chú ý đây là 22 quyền của nhóm Manager bắt buộc có trước khi Admin khởi tạo Manager (tương tự với Employee).

Ví dụ khi Admin tạo 1 account cho Manager. Sau khi tạo xong Manager tự động có 22 quyền này. Admin không đi chỉnh tay hoặc tự thêm từng thằng.

```bash
set PYTHONIOENCODING=utf-8
python manage.py seed_manager_permissions
```

---

# Bước 6: Kiểm tra API bằng trang này

```bash
python manage.py runserver
```

Sau khi server chạy, truy cập:

```text
http://127.0.0.1:8000/api/docs/
```