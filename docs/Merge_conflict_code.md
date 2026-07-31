# 📝 THỐNG KÊ XỬ LÝ XUNG ĐỘT CODE (MERGE CONFLICTS) — NHÁNH MINHANH

> **Tài liệu:** Nhật ký gộp nhánh `origin/MinhAnh` vào nhánh thử nghiệm `worktracker-merge-test`  
> **Thư mục:** `docs/Merge_conflict_code.md`  
> **Ngày thực hiện:** 31/07/2026  
> **Kết quả kiểm thử (Pytest):** ✅ **109/109 Passed (100%)**

---

## 🎯 1. TỔNG QUAN XUNG ĐỘT

Khi thực hiện lệnh `git merge origin/MinhAnh`, Git đã phát hiện 7 file có sự khác biệt giữa hai nhánh (`LongNguyen` và `MinhAnh`). 

Trong đó:
* **4 file xung đột nhỏ (Bỏ qua do chỉ khác biệt comment/khoảng trắng):**
  1. `backend/accounts/authentication.py` *(Chỉ khác biệt câu ghi chú comment tiếng Việt)*
  2. `backend/accounts/models.py` *(Chỉ khác biệt dòng trống)*
  3. `backend/projects/models.py` *(Chỉ khác biệt thụt lề 4 khoảng trắng PEP8)*
  4. `backend/system/migrations/0004_auditlog_severity_auditlog_summary.py` *(Chỉ khác biệt comment ngày giờ sinh file)*

* **3 file xung đột QUAN TRỌNG (Cần thống kê chi tiết bên dưới):**
  1. `backend/requirements.txt`
  2. `backend/worktracker_core/settings.py`
  3. `backend/worktracker_core/urls.py`

---

## 🔍 2. CHI TIẾT CÁC FILE XUNG ĐỘT QUAN TRỌNG & PHƯƠNG ÁN XỬ LÝ

### 📌 1. File `backend/requirements.txt` (Danh sách thư viện PIP)

* **Nguyên nhân xung đột:**
  - Nhánh `LongNguyen` chứa thêm các thư viện nâng cao: `openpyxl` (xuất file Excel), `xhtml2pdf` (xuất file PDF), `django-redis` (bộ nhớ đệm Redis), `celery` (gửi mail ngầm), `channels` (WebSocket real-time) và bộ công cụ `pytest`.
  - Nhánh `MinhAnh` chứa các thư viện cơ bản với phiên bản cũ hơn.
* **Phương án xử lý:**
  - **Giữ lại danh sách thư viện từ `LongNguyen`** để đảm bảo đầy đủ các tính năng xuất báo cáo Excel/PDF, bộ nhớ đệm Redis và WebSocket real-time.
  - Đồng thời cập nhật phiên bản `djangorestframework-simplejwt==5.5.1` để tương thích chuẩn xác.

---

### 📌 2. File `backend/worktracker_core/settings.py` (Cấu hình chính Django)

* **Nguyên nhân xung đột:**
  - `INSTALLED_APPS`: Nhánh `LongNguyen` đăng ký thêm `'django_celery_results'` và `'channels'`, trong khi `MinhAnh` chỉ khai báo `'drf_spectacular'`.
  - `DATABASES`: Nhánh `MinhAnh` dùng `os.environ.get('DB_NAME')` đọc biến từ file `.env` (chuẩn bảo mật), trong khi nhánh `LongNguyen` hardcode sẵn thông số local Postgres.
  - `CACHES` & `CHANNEL_LAYERS`: Nhánh `LongNguyen` cấu hình `RedisCache` (DB=1) và `RedisChannelLayer` (DB=4).
* **Phương án xử lý:**
  - **`INSTALLED_APPS`:** Đăng ký đủ cả 3 app: `'drf_spectacular'`, `'django_celery_results'`, `'channels'`.
  - **`DATABASES`:** Giữ nguyên code của Minh Anh dùng `os.environ.get('DB_NAME')`, đồng thời **tạo mới file `backend/.env`** chứa thông số Postgres để đạt chuẩn bảo mật quốc tế mà vẫn giúp Pytest chạy thành công 100%.
  - **`CACHES` & `CHANNEL_LAYERS`:** Giữ lại cấu hình `RedisCache` và `CHANNEL_LAYERS` phục vụ thông báo Real-time.

---

### 📌 3. File `backend/worktracker_core/urls.py` (Định tuyến API toàn hệ thống)

* **Nguyên nhân xung đột:**
  - Nhánh `LongNguyen` định tuyến các endpoint cho Phân hệ Manager: `/api/manager/...`, cổng auth `/api/auth/...`, Swagger UI và hàm phục vụ file media tĩnh.
  - Nhánh `MinhAnh` định tuyến các endpoint cho Phân hệ Admin: `/api/projects/`, `/api/accounts/`, `/api/system/`, cổng auth `/api/v1/auth/...` và tài liệu Redoc.
* **Phương án xử lý:**
  - **Gộp chung cả 2 hệ thống đường dẫn URL**:
    - Giữ cả 2 cổng đăng nhập `/api/auth/login/` và `/api/v1/auth/login/` để đảm bảo cả Manager UI và Admin UI đều gọi API thành công.
    - Giữ đầy đủ cụm URL Manager (`/api/manager/*`) và cụm URL Admin (`/api/projects/*`, `/api/accounts/*`, `/api/system/*`).
    - Giữ đầy đủ tài liệu API Docs cả Swagger UI (`/api/docs/`) và Redoc (`/api/redoc/`).

---

## 📊 3. TỔNG KẾT
Sau khi gộp 3 file cấu hình quan trọng trên và nạp file `backend/.env`, bộ kiểm thử `pytest` đã chạy lại và đạt kết quả tuyệt đối **109/109 passed in 25.86s**, sẵn sàng cho bước gộp nhánh tiếp theo.
