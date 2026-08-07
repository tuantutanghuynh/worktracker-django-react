# Executive Code Annotation: `backend/system/serializers_admin.py`

**Package / Module:** `backend.system.serializers_admin` · Admin Audit Log Serialization Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (bộ phiên dịch, hộp đen máy bay, kính phóng đại...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Chuyển Đổi Dữ Liệu Nhật Ký Hệ Thống (Audit Log Serializer Diagram)

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    PostgreSQL Database                      │
 │                     Bảng: system_auditlog                   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Django ORM (AuditLog Model Instance)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    AuditLogSerializer                       │
 │              (Kế thừa rest_framework.serializers)           │
 │                                                             │
 │  Meta:                                                      │
 │    model = AuditLog                                         │
 │    fields = '__all__'  (Toàn bộ thuộc tính nhật ký vết)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ JSON Serialization
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                HTTP Response (JSON Payload)                 │
 │   { id, user_id, action, table_name, record_id, ip... }    │
 └─────────────────────────────────────────────────────────────┘
```

> **Vì sao lại sử dụng `fields = '__all__'` trong `AuditLogSerializer` dành cho Admin?**
> Nhật ký vết Audit Log đóng vai trò giống như **"Hộp đen máy bay"** của ứng dụng WorkTracker. Khi Quản trị viên (Admin) xem lại lịch sử tác động hệ thống (ai vừa xóa tài khoản, ai vừa thay đổi deadline dự án, ai vừa sửa nhật ký công), họ cần góc nhìn toàn diện 100% dữ liệu nguyên bản (Actor, Action, Table, Record ID, IP, Old Data, New Data, Timestamp). Khai báo `__all__` đảm bảo mọi trường dữ liệu từ Model `AuditLog` đều được tự động đưa ra API mà không sợ bị bỏ sót thông tin phục vụ truy vết sự cố.

> **Vì sao `AuditLogSerializer` kế thừa từ `serializers.ModelSerializer` thay vì `serializers.Serializer` cơ bản?**
> `ModelSerializer` là lớp tiện ích cao cấp của Django REST Framework. Nó tự động soi cấu trúc các cột trong bảng `AuditLog` để sinh ra các field tương ứng với đúng kiểu dữ liệu (Datetime, JSON, Integer, String...), đồng thời xử lý mã hóa tự động sang định dạng JSON gọn nhẹ, giúp giảm hơn 80% lượng code trùng lặp.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### Chuyển Đổi Model AuditLog Sang JSON Dành Cho Trang Quản Trị

```python
from rest_framework import serializers
# "from rest_framework import serializers" = nạp module `serializers` từ thư viện Django REST Framework.
# Module này cung cấp các lớp công cụ để chuyển đổi qua lại giữa các đối tượng Model Python và định dạng dữ liệu JSON.

from .models import AuditLog
# "from .models import AuditLog" = nạp model `AuditLog` nằm cùng ứng dụng `system`.
# Model này lưu trữ lịch sử thao tác của người dùng trên toàn hệ thống.


class AuditLogSerializer(serializers.ModelSerializer):
# "class AuditLogSerializer(serializers.ModelSerializer):" = định nghĩa lớp Serializer mới kế thừa từ `serializers.ModelSerializer`.
# Class này hoạt động như một "phiên dịch viên" biến các dòng nhật ký từ DB thành chuỗi JSON trả về cho Admin Dashboard.

    class Meta:
    # "class Meta:" = lớp cấu hình nội bộ (Inner Class) quy định hành vi và đối tượng mục tiêu của Serializer.

        model = AuditLog
        # "model = AuditLog" = chỉ định đối tượng Model nguồn mà Serializer này sẽ làm việc cùng là `AuditLog`.

        fields = '__all__'
        # "fields = '__all__'" = chuỗi đặc biệt `'__all__'` báo cho DRF biết:
        # "Hãy bao gồm TOÀN BỘ các trường/cột có trong Model AuditLog vào đầu ra JSON (id, user, action, table_name, changes, created_at...)."
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Thành Phần Code | Loại Thành Phần | Tham Số / Cấu Hình | Mục Đích Kỹ Thuật & Nghiệp Vụ |
|-----------------|-----------------|-------------------|--------------------------------|
| `AuditLogSerializer` | DRF ModelSerializer | Kế thừa `serializers.ModelSerializer` | Chuyển đổi bản ghi lịch sử tác động hệ thống thành JSON cho Admin |
| `Meta.model` | Configuration | `AuditLog` | Liên kết Serializer trực tiếp với bảng nhật ký vết `system_auditlog` |
| `Meta.fields` | Configuration | `'__all__'` | Trả về 100% các cột dữ liệu nhật ký vết, phục vụ truy vết sự cố bảo mật |
