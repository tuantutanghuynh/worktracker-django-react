# 📝 GHI CHÚ NÂNG CẤP MODEL CLIENT (KHÁCH HÀNG / ĐỐI TÁC)
**Dự án:** WorkTracker Pro  
**Thư mục:** `docs/GHI_CHU_NANG_CAP_CLIENT_MODEL.md`  
**Ngày tạo:** 25/07/2026  

---

## 🎯 1. ĐỀ XUẤT CẤU TRÚC NÂNG CẤP MODEL `Client`

Dưới đây là cấu trúc mở rộng chuẩn doanh nghiệp (Enterprise Standard) cho class `Client` trong file `projects/models.py`:

```python
from django.db import models


class Client(models.Model):
    # --- CÁC TRƯỜNG HIỆN TẠI (STABLE CORES) ---
    client_name = models.CharField(max_length=255)
    tax_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )
    contact_person = models.CharField(
        max_length=150,
        blank=True,
        null=True,
    )
    contact_email = models.EmailField(
        max_length=155,
        blank=True,
        null=True,
    )
    contact_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    # ➕ --- CÁC TRƯỜNG MỞ RỘNG ĐỀ XUẤT NÂNG CẤP (ENTERPRISE EXTENSIONS) ---
    address = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )  # Địa chỉ trụ sở / Địa chỉ xuất hóa đơn

    industry = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )  # Lĩnh vực hoạt động (IT, Banking, Finance...)

    notes = models.TextField(
        blank=True,
        null=True,
    )  # Ghi chú nội bộ / Lưu ý khi hợp tác

    created_at = models.DateTimeField(
        auto_now_add=True
    )  # Ngày khởi tạo bản ghi

    updated_at = models.DateTimeField(
        auto_now=True
    )  # Ngày cập nhật thông tin gần nhất

    class Meta:
        db_table = "clients"

    def __str__(self):
        return self.client_name
```

client_name	    ✅ Có (dòng 13)	    Giữ nguyên	Không cần sửa
tax_code	    ✅ Có (dòng 16-20)	Giữ nguyên	Không cần sửa
contact_person	✅ Có (dòng 22-26)	Giữ nguyên	Không cần sửa
contact_email	✅ Có (dòng 27-30)	Giữ nguyên	Không cần sửa
contact_phone	✅ Có (dòng 32-36)	Giữ nguyên	Không cần sửa
is_active	    ✅ Có (dòng 40-43)	Giữ nguyên	Không cần sửa
address	        ❌ Chưa có	        Thêm mới	⚠️ CẦN BỔ SUNG
industry	    ❌ Chưa có	        Thêm mới	⚠️ CẦN BỔ SUNG
notes	        ❌ Chưa có	        Thêm mới	⚠️ CẦN BỔ SUNG
created_at	    ❌ Chưa có	        Thêm mới	⚠️ CẦN BỔ SUNG
updated_at	    ❌ Chưa có	        Thêm mới	⚠️ CẦN BỔ SUNG

---

## 💡 2. PHÂN TÍCH VÌ SAO NÊN BỔ SUNG CÁC TRƯỜNG MỚI NÀY

### 🏢 1. `address` (Địa chỉ trụ sở / Địa chỉ xuất hóa đơn)
- **Lý do cần thêm:** Trong hợp tác B2B thực tế, khi xuất hợp đồng dự án, trích xuất báo cáo nghiệm thu hoặc xuất hóa đơn tài chính GTGT (VAT), địa chỉ chính thức của doanh nghiệp khách hàng là thông tin bắt buộc phải có.

### 🏭 2. `industry` (Lĩnh vực hoạt động / Ngành nghề)
- **Lý do cần thêm:** 
  - Phục vụ phân loại danh mục Khách hàng theo ngành nghề (VD: *Information Technology, Banking & Finance, Retail, Real Estate...*).
  - Khớp 100% với thông tin hiển thị trên giao diện UI **Job Detail** (`Project Description` ➔ Cột `Industry`).
  - Phục vụ trích xuất báo cáo doanh số/giờ làm theo ngành nghề kinh doanh trong tương lai.

### 📝 3. `notes` (Ghi chú nội bộ / Lưu ý hợp tác)
- **Lý do cần thêm:** Giúp lưu trữ các lưu ý đặc thù khi làm việc với đối tác này (VD: *"Khách hàng yêu cầu họp báo cáo định kỳ thứ 6 hàng tuần"*, *"Thường duyệt chi nghiệm thu trong 5 ngày làm việc"*).

### ⏱️ 4. `created_at` & `updated_at` (Ngày tạo & Ngày cập nhật)
- **Lý do cần thêm:** Đây là chuẩn mực bắt buộc (Best Practice) trong thiết kế Cơ sở dữ liệu doanh nghiệp nhằm phục vụ công tác kiểm vết dữ liệu (Audit Trail) — biết chính xác thông tin khách hàng được tạo lúc nào và chỉnh sửa gần nhất vào thời điểm nào.

---

## 🔒 3. ĐẢM BẢO TÍNH TƯƠNG THÍCH (BACKWARD COMPATIBILITY)

Tất cả các trường đề xuất thêm mới đều được thiết lập:
- `blank=True, null=True` (cho phép để trống không bắt buộc điền).
- `auto_now_add=True` / `auto_now=True` (tự động điền ngày giờ ngầm).

👉 Do đó, việc thêm các trường này **không làm đứt gãy (breaking change)** bất kỳ câu lệnh SQL, Serializer, View hay 109 Testcase hiện có nào của hệ thống!

---

## 🔍 4. BÁO CÁO RÀ SOÁT CÁC FILE LIÊN KẾT TRONG HỆ THỐNG

### 📌 1. File `projects/manager/serializers_manager.py` (Manager API Serializers)
- **Vị trí:** Class `ManagerClientMiniSerializer` (Dòng 8 - 15).
- **Hiện trạng:** Hiện tại Serializer này chỉ định nghĩa `fields = ["id", "client_name"]`.
- **Tác động & Đề xuất:** Khi áp dụng trường `industry`, ta chỉ cần thêm `"industry"` vào `fields` của Serializer này để thông tin Ngành nghề tự động truyền ra Frontend, phục vụ cho ô `Industry` trên màn hình giao diện **Job Detail UI**.

### 📌 2. File `projects/manager/views_manager.py` (Manager Job ViewSet)
- **Vị trí:** ViewSet kiểm duyệt `Client.objects.filter(is_active=True)`.
- **Đánh giá:** Logic lọc `is_active` hoạt động chuẩn xác. Việc bổ sung 5 trường mới hoàn toàn không ảnh hưởng hay làm thiếu bất kỳ câu lệnh query nào hiện tại.

### 📌 3. Bộ Kiểm thử Pytest (`backend/testcase/`)
- **Vị trí:** Các file `test_projects_manager.py`, `test_reports_manager.py`, `test_task_manager.py`.
- **Đánh giá:** Do 5 trường mở rộng đều cho phép `null=True` hoặc tự động lấy ngày giờ (`auto_now_add`), thư viện `model_bakery` tự động điền dữ liệu giả mà không bị nổ lỗi. Tất cả **109 testcases hiện tại vẫn sẽ đỗ 100% (Pass)**.

---

## ⚙️ 5. VỊ TRÍ HIỂN THỊ VÀ BỘ CHUYỂN ĐỔI DỮ LIỆU BACKEND (SERIALIZERS MAPPING)

### 🖥️ A. Vị trí hiển thị trên Giao diện Frontend:
1. **`Admin Client Management` (`/admin/clients`)**: Hiển thị trường `notes` (Ghi chú nội bộ) và `address` trong cửa sổ trượt bên phải **`Client Details SideDrawer`** hoặc Modal xem/sửa thông tin khách hàng.
2. **`Manager Create/Edit Job Modal` (`/manager/jobs`)**: Hiển thị ô Ghi chú/Địa chỉ dạng Callout Tooltip để nhắc nhở Manager các lưu ý đặc thù về Khách hàng khi lên kế hoạch dự án.

### 🔌 B. Các File Backend chịu trách nhiệm đẩy dữ liệu JSON:
1. **`projects/admin/serializers_admin.py`**:
   Class `AdminClientDetailSerializer` khai báo các trường `"address"`, `"industry"`, `"notes"` trong `fields` để biến đổi đối tượng Python DB thành chuỗi JSON trả về cho Admin Frontend.
2. **`projects/manager/serializers_manager.py`**:
   Class `ManagerClientMiniSerializer` bổ sung `"address"`, `"notes"` khi Manager truy vấn danh mục Client chọn tạo Job.
3. **`reports/services/report_export_service.py`**:
   Service xuất file báo cáo ở Backend gọi `client.address` và `client.tax_code` để in địa chỉ trụ sở và Mã số thuế lên header tiêu đề văn bản PDF/Excel chính thức.


4. **`them moi database joined_date = models.DateField(blank=True, null=True) trong bang EmployeeProfile. is_active = models.BooleanField(default=True) trong bang Role`
5. Nhom Admin lam CRUD nen them with transaction.atomic() 