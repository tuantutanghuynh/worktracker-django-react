# Executive Code Annotation: `backend/accounts/views_admin.py`

**Package / Module:** `backend.accounts.views_admin` · Admin IAM Controllers & API Views Layer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm ví von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Kiến Trúc Admin Views & Luồng Kiểm Soát Quyền (Admin Views Architecture)

```
                       ┌──────────────────────────────────────────┐
                       │    HTTP Request (Từ Admin Web Client)    │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │     views_admin.py (Tầng Điều Hướng)     │
                       └──────┬─────────────┬─────────────┬───────┘
                              │             │             │
              ┌───────────────┘             │             └───────────────┐
              ▼                             ▼                             ▼
   ┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
   │HasPermission Check │        │   UserViewSet      │        │ AdminDisableUser   │
   │ (user:create,      │        │ (CRUD + Lock/Unlock│        │ (Offboarding User  │
   │  user:update...)   │        │  + Soft Delete)    │        │  Vô hiệu hóa ngay) │
   └─────────┬──────────┘        └─────────┬──────────┘        └─────────┬──────────┘
             │                             │                             │
             ▼                             ▼                             ▼
   ┌────────────────────────────────────────────────────────────────────────────────┐
   │         Redis DB 2 Cache Synchronization (set_user_active_status)              │
   │               & PostgreSQL Database State Update                               │
   └────────────────────────────────────────────────────────────────────────────────┘
```

> **Vì sao phải gọi `set_user_active_status(user.id, False/True)` tới Redis mỗi khi Lock/Unlock/Soft-delete User?**
> - **Cơ chế Cache Vô Hiệu Hóa Real-time (Real-time Token Revocation):** Khi người dùng bị khóa tài khoản hoặc bị xóa (offboarding), JWT Access Token của họ vẫn có thể còn hiệu lực tới 15 phút. Nếu không đồng bộ trạng thái `is_active = False` lập tức vào Redis DB 2 Cache, người dùng bị khóa vẫn có thể tiếp tục gửi request gọi API thành công trong 15 phút đó.
> - Việc gọi `set_user_active_status` giúp middleware xác thực kiểm tra Redis và chặn đứng request của user bị khóa ngay lập tức ở request kế tiếp (đạt tiêu chí an ninh NFR-04).

> **Vì sao `UserViewSet` dùng `select_related('role', 'profile')` trong `queryset`?**
> - **Tối ưu hóa truy vấn N+1 (N+1 Query Optimization):** Khi lấy danh sách 100 người dùng, nếu không có `select_related`, Django sẽ thực hiện 1 truy vấn lấy danh sách User, sau đó chạy thêm 100 truy vấn lấy `role` và 100 truy vấn lấy `profile` (tổng cộng 201 SQL queries).
> - Với `select_related('role', 'profile')`, Django ORM dùng câu lệnh SQL `INNER JOIN` để gộp cả 3 bảng trong DUY NHẤT 1 lần truy vấn DB, giảm tải hệ thống đáng kể.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Nạp Thư Viện, Components & Models (Imports & Declarations)

```python
from rest_framework import viewsets
# "viewsets" là module chứa các CLASS TỔ HỢP SẴN nhiều generic view (List, Create, Retrieve, Update, Destroy)
# thành 1 class duy nhất -- `viewsets.ModelViewSet` (dùng ở UserViewSet/RoleViewSet/DepartmentViewSet bên dưới)
# cung cấp ĐỦ CẢ 5 THAO TÁC CRUD chỉ bằng cách khai báo `queryset` + `serializer_class`, không cần tự viết
# get()/post()/put()/delete() như APIView. `viewsets.ReadOnlyModelViewSet` (dùng ở PermissionViewSet) chỉ
# tổ hợp 2 thao tác List + Retrieve, KHÔNG có Create/Update/Delete -- gọi POST/PUT/DELETE vào đó sẽ tự trả 405.

from rest_framework.views import APIView
# APIView vẫn cần dùng riêng cho `AdminDisableUserView` bên dưới -- vì "disable 1 user" không phải 1 thao
# tác CRUD chuẩn (không map vào Create/Retrieve/Update/Delete nào), nên phù hợp viết dạng endpoint đơn lẻ.

from rest_framework.decorators import action
# "@action" là 1 DECORATOR (hàm bậc cao nhận 1 hàm khác làm input, trả về 1 hàm mới đã "khoác thêm" hành vi).
# Cú pháp `@action(...)` đặt phía trên 1 method bên trong ViewSet KHÔNG NẰM TRONG 5 thao tác CRUD chuẩn (vd
# lock/unlock bên dưới) -- decorator này gắn thêm METADATA (detail, methods, url_path) lên hàm, để DRF Router
# (khai báo ở urls_admin.py) tự sinh thêm URL riêng cho đúng method đó, ngoài các URL CRUD mặc định.

from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model

from .authentication import set_user_active_status
# Import lại chính hàm đã học ở file 05 (authentication.py) -- đây là "mắt xích" giúp thao tác Admin (khóa/mở
# khóa/soft-delete user) ĐỒNG BỘ NGAY LẬP TỨC với Redis Cache mà middleware xác thực đọc ở MỌI request sau đó.

from .models import CustomUser, Role, Permission, Department
from .permissions import HasPermission
# "HasPermission" (xem permissions.py) có 2 CÁCH DÙNG khác nhau trong chính file này:
#   1. `permission_classes = [HasPermission]` (AdminDisableUserView) -- truyền THẲNG CLASS, không gọi ().
#      DRF tự khởi tạo `HasPermission()` KHÔNG THAM SỐ -> __init__(required_permission=None) -> self.required_permission
#      = None -> has_permission() phải FALLBACK đọc `getattr(view, 'required_permission', None)`, tức đọc
#      thuộc tính class-level `required_permission = "user:disable"` khai báo trên chính view.
#   2. `[HasPermission('user:create')]` (UserViewSet.get_permissions) -- gọi CONSTRUCTOR TRỰC TIẾP với đối số,
#      tạo ra 1 INSTANCE đã có sẵn self.required_permission = 'user:create' ngay từ đầu, không cần fallback.
#   Cả 2 cách đều hợp lệ vì __init__ có tham số mặc định `required_permission=None` -- linh hoạt cho cả
#   pattern "khai báo cố định trên class" (APIView đơn) lẫn "khai báo động theo action" (ViewSet nhiều action).

from .serializers_admin import (
    UserSerializer, UserCreateSerializer,
    RoleSerializer, PermissionSerializer, DepartmentSerializer,
)
# Import 5 tên nằm TRONG DẤU NGOẶC ĐƠN () trải nhiều dòng -- đây là cú pháp Python cho phép XUỐNG DÒNG GIỮA
# 1 CÂU LỆNH khi có cặp ngoặc bao quanh (khác với 1 dòng from-import dài lê thê như ở file views_auth.py).

User = get_user_model()

# This file holds ADMIN-only views for the accounts app. Add future
# Identity & Access Management endpoints here (create user, enable/unlock
# account, role assignment, department CRUD...), not in views.py.
```

---

### 2. View Vô Hiệu Hóa User Cho Admin (Admin Disable User Single API View)

```python
# Permission-only example: ADMIN can disable any user account (offboarding).
# No data isolation needed here, since ADMIN isn't restricted to a subset of users.

class AdminDisableUserView(APIView):
    required_permission = "user:disable"
    # Đây là CLASS ATTRIBUTE thuần (không phải field DRF nào cả) -- tự đặt tên tùy ý, chỉ có Ý NGHĨA vì
    # `HasPermission.has_permission()` (permissions.py dòng 12) biết ĐỌC ĐÚNG TÊN "required_permission" này
    # qua `getattr(view, 'required_permission', None)` -- đổi tên thuộc tính này sẽ khiến check quyền luôn
    # None -> permissions.py ném AssertionError ngay khi có request tới.

    permission_classes = [HasPermission]
    # Truyền CLASS trần (không gọi ()) -- khác hẳn cách UserViewSet gọi `HasPermission('user:create')` bên
    # dưới. DRF sẽ tự `HasPermission()` (không tham số) rồi mới gọi `.has_permission(request, view)`.

    def post(self, request, user_id):
    # `user_id` là THAM SỐ THỨ 3 (sau self, request) -- Django tự truyền vào từ 1 GROUP ĐẶT TÊN trong route
    # URL (vd `path("users/<int:user_id>/disable/", ...)` ở urls_admin.py) -- tên tham số ở đây PHẢI KHỚP
    # CHÍNH XÁC với tên group trong route, nếu không Django ném TypeError "unexpected keyword argument".

        target_user = User.objects.filter(id=user_id).first()
        if target_user is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            # Cách xử lý "không tìm thấy" ở đây là TỰ VIẾT TAY (filter().first() + if None) -- so sánh với
            # UserViewSet.lock() bên dưới dùng `self.get_object()` (tự động 404 sẵn, không cần viết if) -- vì
            # APIView KHÔNG kế thừa GenericAPIView nên không có sẵn get_object(), phải tự xử lý thủ công.

        target_user.is_active = False
        target_user.save()

        return Response({"detail": "User disabled"}, status=status.HTTP_200_OK)
        # LƯU Ý QUAN TRỌNG khi đối chiếu với "Vì sao" ở đầu file: hàm này KHÔNG gọi `set_user_active_status()`
        # như `perform_destroy`/`lock`/`unlock` bên dưới đều có làm. Nghĩa là user vừa bị Admin "disable" qua
        # đúng API này vẫn có thể dùng Access Token còn hạn để gọi API thành công trong tối đa 5 phút (TTL của
        # Redis cache is_active, xem file 05) thay vì bị chặn NGAY LẬP TỨC như 3 chỗ kia -- một điểm chưa đồng
        # bộ đáng lưu ý giữa các đường "khóa tài khoản" khác nhau trong code hiện tại của project.
```

---

### 3. ViewSet Quản Lý Người Dùng & Các Thao Tác Lock/Unlock (User ViewSet)

```python
class UserViewSet(viewsets.ModelViewSet):
# `ModelViewSet` TỰ ĐỘNG có sẵn 5 action chuẩn: list (GET nhiều), retrieve (GET 1), create (POST), update
# (PUT), partial_update (PATCH), destroy (DELETE) -- mình KHÔNG viết method nào trong 5 cái đó ở class này,
# chỉ override 3 HOOK (get_permissions, get_serializer_class, perform_destroy) để TÙY BIẾN hành vi mặc định,
# và thêm 2 action ngoài chuẩn (lock/unlock) bằng @action.

    queryset = CustomUser.objects.select_related('role', 'profile').all()
    # `.select_related('role', 'profile')` báo Django ORM SQL JOIN LUÔN 2 bảng role/profile trong CÙNG 1 câu
    # SELECT (dùng INNER/LEFT JOIN), thay vì phải chạy thêm N câu SELECT riêng lẻ mỗi khi code đọc
    # `user.role`/`user.profile` cho từng user trong danh sách (vấn đề N+1 query) -- .all() sau cùng vẫn LAZY
    # (chưa chạy SQL thật cho tới khi thứ gì đó duyệt qua QuerySet, vd khi DRF render list response).

    serializer_class = UserSerializer
    # Đây là GIÁ TRỊ MẶC ĐỊNH -- method `get_serializer_class()` bên dưới có thể GHI ĐÈ giá trị này tùy theo
    # action, nhưng nếu KHÔNG override, DRF vẫn có class attribute này để fallback dùng.

    def get_permissions(self):
    # HOOK method DRF tự gọi TRƯỚC MỖI request (tương tự get_authenticators() ở file authentication.py) để
    # BIẾT cần kiểm tra quyền nào. `self.action` là thuộc tính DRF TỰ GÁN vào instance ViewSet trước khi gọi
    # hook này -- giá trị của nó là 1 CHUỖI tên action đang chạy: 'list'/'create'/'retrieve'/'update'/
    # 'partial_update'/'destroy', hoặc TÊN METHOD tự định nghĩa qua @action (vd 'lock', 'unlock' bên dưới).

        if self.action == 'create':
            return [HasPermission('user:create')]
            # Gọi CONSTRUCTOR HasPermission('user:create') trực tiếp -- khác cách dùng ở AdminDisableUserView
            # (truyền class trần) vì ở đây CẦN quyền KHÁC NHAU tùy action, không thể khai báo cố định 1 giá
            # trị `required_permission` chung ở class-level.

        return [HasPermission('user:update')]
        # Đây là NHÁNH MẶC ĐỊNH (fallback): mọi action KHÔNG PHẢI 'create' (list, retrieve, update,
        # partial_update, destroy, VÀ CẢ lock/unlock) đều rơi vào đây, yêu cầu chung 1 quyền 'user:update'.

    def get_serializer_class(self):
    # HOOK khác của DRF, gọi mỗi request để chọn Serializer nào dùng cho action hiện tại -- tách biệt hoàn
    # toàn với get_permissions() dù cùng đọc self.action, vì 2 mối quan tâm khác nhau (ai được gọi vs dữ liệu
    # đọc/ghi dạng gì).

        if self.action == 'create':
            return UserCreateSerializer
            # Chỉ action 'create' mới cần field "password" -> dùng đúng Serializer có field đó (xem file 10).

        return UserSerializer
        # Mọi action còn lại dùng UserSerializer -- Serializer này KHÔNG có field password nên an toàn khi
        # đọc (list/retrieve) lẫn khi cập nhật (update/partial_update, vì Admin sửa thông tin không cần đổi pass).

    def perform_destroy(self, instance):
    # `ModelViewSet.destroy()` (action DELETE mặc định) gọi `self.perform_destroy(instance)` ở BƯỚC CUỐI --
    # override ĐÚNG hook này (không phải override destroy() luôn) là cách CHUẨN của DRF để thay đổi HÀNH VI
    # XÓA mà KHÔNG PHẢI viết lại toàn bộ logic tìm object/kiểm tra quyền/trả response của destroy() gốc.
        instance.is_active = False
        instance.save()
        # SOFT DELETE: đổi cờ is_active thay vì `instance.delete()` (xóa hẳn khỏi DB) -- dữ liệu vẫn còn để
        # tra cứu lịch sử (audit, báo cáo cũ liên quan tới user này vẫn còn hợp lệ về mặt khóa ngoại).

        set_user_active_status(instance.id, False)
        # Gọi ngay sau .save() -- đồng bộ Redis Cache TỨC THÌ, không đợi TTL 5 phút tự hết hạn (khác với lỗ
        # hổng đã ghi chú ở AdminDisableUserView phía trên).

    @action(detail=True, methods=['patch'], url_path='lock')
    # `@action(...)` gắn METADATA lên hàm `lock` ngay bên dưới -- Router (khai báo ở urls_admin.py) đọc
    # metadata này để TỰ SINH thêm URL `/users/{pk}/lock/` ngoài 5 URL chuẩn của ModelViewSet.
    # `detail=True`: route này thao tác trên 1 OBJECT CỤ THỂ (cần pk trong URL), khác `detail=False` sẽ sinh
    # route dạng danh sách không cần pk (vd `/users/lock-all/`, không dùng ở đây).
    # `methods=['patch']`: LIST chỉ chứa đúng 1 HTTP verb được chấp nhận cho route này -- gọi GET/POST vào
    # `/users/{pk}/lock/` sẽ bị DRF tự trả 405 Method Not Allowed.
    def lock(self, request, pk=None):
    # Tên hàm "lock" TỰ ĐỘNG trở thành giá trị của `self.action` khi route này được gọi (khớp với nhánh
    # get_permissions() fallback ở trên). `pk=None` là default param -- Router LUÔN truyền pk thật từ URL nên
    # giá trị None gần như không bao giờ thực sự được dùng, nhưng vẫn cần khai báo để khớp signature chuẩn.
        user = self.get_object()
        # `self.get_object()` là method CÓ SẴN từ GenericAPIView (ModelViewSet kế thừa) -- tự động: lấy pk từ
        # URL, query trong `self.queryset` (đã có sẵn select_related ở trên), và TỰ NÉM Http404 nếu không tìm
        # thấy -- KHÔNG CẦN viết `if user is None: return 404` thủ công như AdminDisableUserView phải làm.

        user.is_active = False
        user.save()
        set_user_active_status(user.id, False)

        return Response({'detail': 'User locked.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='unlock')
    def unlock(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save()
        set_user_active_status(user.id, True)
        # Cùng cấu trúc y hệt lock(), chỉ đảo giá trị Boolean True/False -- đối xứng hoàn toàn với lock().

        return Response({'detail': 'User unlocked.'}, status=status.HTTP_200_OK)
```

---

### 4. ViewSets Quản Lý Vai Trò, Quyền Hạn & Phòng Ban (Role, Permission & Department ViewSets)

```python
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

    def get_permissions(self):
        return [HasPermission('role:manage')]
        # KHÔNG có `if self.action == ...` như UserViewSet/DepartmentViewSet -- return NGAY 1 giá trị DUY
        # NHẤT bất kể action là gì (list/create/update/destroy đều cùng cần 'role:manage'). Đây là lựa chọn
        # thiết kế hợp lý vì vai trò hệ thống không có khái niệm "ai cũng đọc được nhưng chỉ Admin mới sửa" --
        # chỉ người có 'role:manage' mới được đụng vào Role dưới bất kỳ hình thức nào.


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
# Kế thừa `ReadOnlyModelViewSet` (không phải ModelViewSet) -- class này chỉ TRỘN (mixin) 2 action List +
# Retrieve, hoàn toàn KHÔNG CÓ method create/update/destroy nào tồn tại trong class cha -- nghĩa là dù có lỡ
# quên get_permissions() hay không, việc gọi POST/PUT/DELETE vào route này vẫn 405 ngay từ tầng Router, không
# phải nhờ permission chặn. Phù hợp vì danh mục Permission là DANH SÁCH CỐ ĐỊNH của hệ thống, Admin chỉ XEM,
# không tự thêm/sửa/xóa qua API (thêm permission mới là việc của lập trình viên qua migration).

    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer

    def get_permissions(self):
        return [HasPermission('role:manage')]
        # Dùng CHUNG mã quyền 'role:manage' với RoleViewSet (không có mã quyền riêng "permission:view") --
        # gộp logic vì xem danh sách Permission chỉ có ý nghĩa khi đang thao tác gán quyền cho Role.


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related('manager').all()
    # `select_related('manager')` JOIN sẵn bảng User đóng vai trò Trưởng phòng -- cùng lý do N+1 query đã
    # giải thích ở UserViewSet, áp dụng cho field `manager` (Foreign Key trỏ tới CustomUser) của Department.

    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [HasPermission('department:create')]

        return [HasPermission('department:update')]
        # Cùng CẤU TRÚC 2 nhánh y hệt UserViewSet.get_permissions() (tách riêng quyền tạo mới vs các thao tác
        # còn lại) -- đây là 1 PATTERN LẶP LẠI có chủ đích trong toàn bộ file, không phải trùng hợp: bất kỳ
        # ViewSet nào cần phân biệt quyền "tạo" khỏi quyền "sửa/xóa" đều viết theo đúng khuôn if/else này.
```

---

## Bảng Tóm Tắt Thiết Kế (Design Summary Table)

| View / ViewSet Class | Supported HTTP Methods | Endpoint Pattern | Permissions Required | Database Optimization & Cache Sync |
| :--- | :--- | :--- | :--- | :--- |
| **`AdminDisableUserView`** | POST | `/user/{id}/disable/` | `user:disable` | Khóa tài khoản khẩn cấp bằng thao tác đơn lẻ. |
| **`UserViewSet`** | GET, POST, PUT, PATCH, DELETE | `/users/`, `/users/{id}/` | `user:create` (POST), `user:update` (Khác) | `select_related('role', 'profile')`, Soft Delete + Redis Cache sync. |
| **`UserViewSet.lock`** | PATCH | `/users/{id}/lock/` | `user:update` | Chuyển `is_active = False` & gọi `set_user_active_status(id, False)` vào Redis. |
| **`UserViewSet.unlock`** | PATCH | `/users/{id}/unlock/` | `user:update` | Chuyển `is_active = True` & gọi `set_user_active_status(id, True)` vào Redis. |
| **`RoleViewSet`** | GET, POST, PUT, PATCH, DELETE | `/roles/`, `/roles/{id}/` | `role:manage` | Quản lý định danh các vai trò hệ thống. |
| **`PermissionViewSet`** | GET (Read-only) | `/permissions/`, `/permissions/{id}/` | `role:manage` | ReadOnlyModelViewSet bảo vệ danh mục quyền chuẩn. |
| **`DepartmentViewSet`** | GET, POST, PUT, PATCH, DELETE | `/departments/`, `/departments/{id}/` | `department:create` / `department:update` | `select_related('manager')` tối ưu SQL JOIN lấy Trưởng phòng. |
