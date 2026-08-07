# Executive Code Annotation: `backend/accounts/serializers_admin.py`

**Package / Module:** `backend.accounts.serializers_admin` · Admin IAM Serializers Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Serializer Admin (Admin Serializers Diagram)

```
                       ┌──────────────────────────────────────────┐
                       │     JSON Payload (Từ Quản Trị Viên)      │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │   serializers_admin.py (Tầng Phiên Dịch) │
                       └──────┬─────────────┬─────────────┬───────┘
                              │             │             │
              ┌───────────────┘             │             └───────────────┐
              ▼                             ▼                             ▼
   ┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
   │ UserCreateSerializer│        │   UserSerializer   │        │DepartmentSerializer│
   │ (Mã hóa Pass &     │        │ (Biến đổi Nested   │        │ (Quản lý Phòng Ban │
   │  Tạo User mới)     │        │  Role + Profile)   │        │  & Trưởng Phòng)   │
   └─────────┬──────────┘        └─────────┬──────────┘        └─────────┬──────────┘
             │                             │                             │
             ▼                             ▼                             ▼
   ┌────────────────────────────────────────────────────────────────────────────────┐
   │                 Database Models (CustomUser, Role, Department...)              │
   └────────────────────────────────────────────────────────────────────────────────┘
```

> **Vì sao tách riêng `UserCreateSerializer` và `UserSerializer`?**
> - **Bảo mật tuyệt đối (Security & Password Hashing):** Khi tạo người dùng mới, hệ thống cần nhận trường `password` từ API nhưng phải mã hóa (hash via `create_user`) trước khi lưu vào DB. Mật khẩu không bao giờ được xuất ngược ra JSON ở API đọc thông tin người dùng (`UserSerializer`).
> - **Tránh lộ thông tin nhạy cảm:** `UserSerializer` hiển thị thông tin đầy đủ gồm `profile` và `role_detail` để Admin xem giao diện tổng quan, còn `UserCreateSerializer` chỉ làm đúng nhiệm vụ thu nhận thông số tạo tài khoản ban đầu.

> **Vì sao dùng `extra_kwargs = {'role': {'write_only': True}}` kết hợp với `role_detail = RoleSerializer(source='role', read_only=True)`?**
> Đây là kỹ thuật thiết kế API chuyên nghiệp (Write-by-ID, Read-by-Object):
> - Khi Admin gửi request tạo/cập nhật user, họ chỉ cần truyền ID đại diện cho vai trò (ví dụ: `"role": 2`). Do đó `role` là trường `write_only`.
> - Khi backend trả về thông tin user cho React Frontend hiển thị lên giao diện Admin, React cần cả tên vai trò, mã vai trò (VD: `code: "MANAGER", name: "Quản lý phòng"`). Backend sử dụng `role_detail` (được đọc từ `source='role'`) ở dạng `read_only` để lồng (nest) toàn bộ object Role vào JSON.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện & Model Hệ Thống (Imports & Model Binding)

```python
from rest_framework import serializers
# Import cả MODULE "serializers" -- mọi class dùng trong file (Serializer, ModelSerializer, CharField...) đều
# phải gọi qua tiền tố `serializers.X`. Khác với file serializers_auth.py (chỉ dùng `serializers.Serializer`
# thuần), file này CHỦ YẾU dùng `serializers.ModelSerializer` -- một BIẾN THỂ MẠNH HƠN: thay vì tự khai báo
# từng field thủ công, ModelSerializer đọc cấu trúc cột của 1 Django Model rồi TỰ SINH RA field tương ứng
# (vd cột CharField trong Model -> tự tạo serializers.CharField với đúng max_length, required...).

from .models import Role, Permission, CustomUser, Department, EmployeeProfile
# Import 5 Model cùng lúc trên 1 dòng, relative import từ models.py cùng app accounts/. Mỗi Model dưới đây sẽ
# được gán vào thuộc tính `model = ...` bên trong `class Meta` của từng Serializer tương ứng.
```

---

### 2. Bộ Phiên Dịch Vai Trò & Quyền Hạn (Role & Permission Serializers)

```python
# ADMIN-only serializers for user/role/permission/department management.

class RoleSerializer(serializers.ModelSerializer):
# Kế thừa `serializers.ModelSerializer` (KHÔNG PHẢI `serializers.Serializer` thuần) -- điểm khác biệt cốt lõi:
# ModelSerializer TỰ ĐỘNG sinh field dựa theo cột của Model khai báo trong Meta bên dưới, mình không cần viết
# tay `code = serializers.CharField(max_length=...)` như phải làm với Serializer thuần.

    class Meta:
    # "class Meta" là 1 CLASS LỒNG BÊN TRONG CLASS -- đây KHÔNG PHẢI để tạo instance (không ai gọi Meta()),
    # mà chỉ đóng vai trò 1 "TÚI CẤU HÌNH" mà ModelSerializer.__new__ (metaclass) đọc qua bằng introspection
    # (getattr) ngay khi class RoleSerializer được ĐỊNH NGHĨA (không phải lúc khởi tạo instance) để biết
    # cần sinh field nào. Quy ước tên "Meta" là bắt buộc -- đặt tên khác DRF sẽ không tìm thấy cấu hình.

        model = Role
        # Trỏ Meta tới đúng Model nguồn -- ModelSerializer đọc field của Model NÀY để đối chiếu với "fields"
        # bên dưới rồi tự sinh serializer field tương ứng (đúng kiểu dữ liệu, đúng ràng buộc null/blank...).

        fields = ['id', 'code', 'name', 'description', 'is_active']
        # LIST CHUỖI TÊN CỘT (không phải object field) -- ModelSerializer dùng từng chuỗi này để TRA CỨU
        # ngược lại cột tương ứng trên Model Role rồi tự sinh field, KHÔNG có field nào ở đây được viết tay.
        # Đây là lý do class RoleSerializer trông "trống rỗng" (không có field nào khai báo ở class-level)
        # nhưng khi dùng `RoleSerializer().fields` vẫn thấy đủ 5 field -- chúng được sinh NGẦM lúc class load.


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name']
        # Cùng cơ chế tự sinh field như RoleSerializer, chỉ khác Model nguồn (Permission) và danh sách cột.
        # Không có method nào override (create/update) -- ModelSerializer có sẵn create()/update() mặc định
        # (tự gọi Permission.objects.create(**validated_data)), đủ dùng vì Permission không cần logic đặc biệt.
```

---

### 3. Bộ Phiên Dịch Hồ Sơ Nhân Viên & Tài Khoản Xem Chi Tiết (Employee Profile & User Serializers)

```python
class EmployeeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeProfile
        fields = ['full_name', 'phone_number', 'department', 'avatar_url', 'joined_date']
        # Serializer này KHÔNG đứng độc lập trong luồng thực tế -- nó được dùng làm "khuôn" cho field `profile`
        # bên trong UserSerializer ngay dưới đây (kỹ thuật NESTED SERIALIZER), chứ hiếm khi tự gọi trực tiếp.


class UserSerializer(serializers.ModelSerializer):
    profile = EmployeeProfileSerializer(read_only=True)
    # Đây là field KHAI BÁO TƯỜNG MINH (explicit field) ở cấp class -- GHI ĐÈ lên field mà ModelSerializer lẽ
    # ra sẽ tự sinh cho cột "profile". Giá trị gán vào KHÔNG PHẢI 1 kiểu field đơn giản (CharField...), mà là
    # 1 INSTANCE của chính EmployeeProfileSerializer -- đây gọi là NESTED SERIALIZER: khi serialize ra JSON,
    # DRF không trả 1 số ID, mà trả nguyên 1 OBJECT LỒNG BÊN TRONG chứa đủ full_name/phone_number/...
    # Không truyền `source=` ở đây -- DRF ngầm định source TRÙNG TÊN FIELD ("profile"), tức đọc thuộc tính
    # `user_instance.profile` (quan hệ OneToOne ngược từ CustomUser sang EmployeeProfile khai báo trong models.py).
    # `read_only=True`: field này chỉ xuất hiện khi ĐỌC (GET) response, nếu Admin gửi JSON có key "profile" khi
    # POST/PUT, DRF sẽ BỎ QUA giá trị đó, không cố gắng ghi đè.

    role_detail = RoleSerializer(source='role', read_only=True)
    # Cũng là nested serializer, nhưng lần này BẮT BUỘC truyền `source='role'` tường minh -- vì TÊN FIELD
    # ("role_detail") KHÁC với tên thuộc tính thật trên Model ("role") -- source chính là "cầu nối" báo cho
    # DRF: "khi cần giá trị cho field role_detail, hãy đọc từ user_instance.role, không phải user_instance.role_detail
    # (thuộc tính đó không tồn tại trên Model, sẽ ném AttributeError nếu thiếu source)".

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'role', 'role_detail', 'is_active', 'profile']
        # LƯU Ý: list này chứa CẢ "role" LẪN "role_detail" -- 2 TÊN KHÁC NHAU CÙNG TRỎ VỀ 1 CỘT DỮ LIỆU:
        #   - "role"        -> ModelSerializer tự sinh field mặc định (1 số ID nguyên) vì có mặt trong fields
        #                      nhưng KHÔNG được khai báo tường minh ở trên -- rồi extra_kwargs bên dưới ép nó
        #                      thành write_only.
        #   - "role_detail" -> field TƯỜNG MINH đã khai báo phía trên (nested RoleSerializer, read_only).
        # Kết quả: JSON GỬI LÊN dùng {"role": 2}, JSON TRẢ VỀ dùng {"role_detail": {"id":2,"code":"MANAGER",...}}
        # -- 2 chiều dùng 2 field khác tên, cùng 1 cột DB, đây chính là kỹ thuật "Write-by-ID, Read-by-Object".

        extra_kwargs = {'role': {'write_only': True}}
        # `extra_kwargs` là 1 DICT LỒNG DICT: key ngoài là TÊN FIELD ("role"), value là 1 dict các OPTION bổ
        # sung áp cho field đó (ở đây chỉ có write_only=True). Đây là cách BỔ SUNG option cho field mà
        # ModelSerializer TỰ SINH (field "role" không được khai báo tường minh ở class-level như profile/
        # role_detail) -- nếu muốn field tự sinh có thêm ràng buộc, dùng extra_kwargs thay vì viết lại cả field.
```

---

### 4. Bộ Phiên Dịch Tạo Mới Tài Khoản & Quản Lý Phòng Ban (User Creation & Department Serializers)

```python
class UserCreateSerializer(serializers.ModelSerializer):
# Vì sao KHÔNG tái sử dụng UserSerializer để tạo user luôn? Vì UserSerializer không có field "password" (cố
# tình không có, để tuyệt đối không leak password khi ĐỌC user) -- cần 1 class RIÊNG chỉ dùng cho hành động
# TẠO (write), có field password mà UserSerializer không có.

    password = serializers.CharField(write_only=True)
    # Field khai báo TƯỜNG MINH -- ghi đè field mà ModelSerializer LẼ RA sẽ tự sinh cho cột "password" của
    # CustomUser (mặc định Django sẽ tự đoán ra CharField giống hệt, NHƯNG mình khai báo lại tường minh ở đây
    # chủ yếu để làm RÕ Ý ĐỊNH `write_only=True` ngay tại chỗ, dễ đọc hơn là giấu trong extra_kwargs).

    class Meta:
        model = CustomUser
        fields = ['email', 'password', 'role', 'is_active']

    def create(self, validated_data):
    # ModelSerializer đã CÓ SẴN 1 method `create()` mặc định (tự gọi `CustomUser.objects.create(**validated_data)`)
    # -- ở đây OVERRIDE lại (trùng tên method) vì cách tạo mặc định sẽ gán password dạng PLAINTEXT thẳng vào
    # cột password, sai hoàn toàn về bảo mật. `validated_data` là dict đã qua validate tất cả field trong fields.
    # Method create() này được DRF TỰ GỌI khi code ở view gọi `serializer.save()` (không gọi create() trực tiếp).

        password = validated_data.pop('password')
        # `.pop('password')` làm 2 VIỆC CÙNG LÚC: (1) TRẢ VỀ giá trị của key "password", (2) XÓA LUÔN key đó
        # khỏi dict validated_data (mutate tại chỗ) -- khác hẳn `.get('password')` (chỉ đọc, không xóa) hay
        # `['password']` (chỉ đọc, ném KeyError nếu thiếu). Việc XÓA là chủ đích: để dòng dưới `**validated_data`
        # không còn chứa key "password" nữa, tránh bị truyền trùng 2 lần vào create_user().

        return CustomUser.objects.create_user(password=password, **validated_data)
        # `**validated_data` là UNPACKING OPERATOR cho dict: "bung" từng cặp key-value còn lại (email, role,
        # is_active) ra thành các KEYWORD ARGUMENT rời, tương đương viết tay
        # `create_user(password=password, email=validated_data['email'], role=validated_data['role'], is_active=validated_data['is_active'])`.
        # Nếu không .pop() password trước, validated_data vẫn còn key "password" -> **validated_data sẽ tạo
        # ra 2 tham số `password=` trùng tên (1 tường minh, 1 từ unpack) -> Python ném TypeError ngay lập tức.
        # `.create_user(...)` (khác `.create()` thường của QuerySet Manager) là METHOD TÙY BIẾN trên UserManager
        # của Django Auth, tự HASH password bằng thuật toán trong PASSWORD_HASHERS trước khi lưu, không bao
        # giờ lưu chuỗi thô.


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'manager', 'created_at']
        # Không có field khai báo tường minh, không override create()/update() -- toàn bộ hành vi dùng đúng
        # mặc định của ModelSerializer, phù hợp vì Department không có logic đặc biệt nào cần xử lý riêng.
```

---

## Bảng Tóm Tắt Thiết Kế (Design Summary Table)

| Serializer Name | Target Model | Chức Năng Chính | Trường Viết (Write Fields) | Trường Đọc (Read Fields) | Quy Tắc Bảo Mật & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`RoleSerializer`** | `Role` | CRUD vai trò hệ thống | `code`, `name`, `description`, `is_active` | `id`, `code`, `name`, `description`, `is_active` | Chuẩn hóa mã vai trò RBAC cho toàn ứng dụng. |
| **`PermissionSerializer`** | `Permission` | Xem danh mục quyền hạn | Không có (Read-only) | `id`, `code`, `name` | Liệt kê các quyền RBAC dạng fine-grained. |
| **`EmployeeProfileSerializer`** | `EmployeeProfile` | Mã hóa thông tin nhân viên | Không áp dụng trực tiếp | `full_name`, `phone_number`, `department`, `avatar_url`, `joined_date` | Lồng trong `UserSerializer` qua mối quan hệ 1-1. |
| **`UserSerializer`** | `CustomUser` | Xem/Cập nhật User cho Admin | `role` (ID số) | `id`, `email`, `role_detail`, `is_active`, `profile` | Tách biệt Read ID vs Write Object (`role` vs `role_detail`). |
| **`UserCreateSerializer`** | `CustomUser` | Tạo tài khoản người dùng mới | `email`, `password`, `role`, `is_active` | Tất cả trừ `password` | Dùng `create_user` băm mật khẩu, `password` là `write_only`. |
| **`DepartmentSerializer`** | `Department` | Quản lý phòng ban công ty | `name`, `description`, `manager` | `id`, `name`, `description`, `manager`, `created_at` | Gắn kết Trưởng phòng (`manager`) quản lý phòng ban. |
