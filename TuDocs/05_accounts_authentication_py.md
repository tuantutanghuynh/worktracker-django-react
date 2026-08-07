# Executive Code Annotation: `backend/accounts/authentication.py`

**Package / Module:** `backend.accounts.authentication` · High-Performance JWT & Redis Cache Authenticator

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm vị von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Quy Trình Xác Thực Tốc Độ Cao (JWT Authentication & Redis Caching Pipeline)

```
                            ┌───────────────────────────────┐
                            │    HTTP Request + JWT Token   │
                            └───────────────┬───────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │ WorkTrackerJWTAuthentication.authenticate()   │
                    └───────────────┬───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────────────────────┐
                    │ 1. BlacklistAwareJWTAuthentication            │
                    │    - Validate JWT signature & expiration     │
                    │    - Check Redis DB 1: f"blacklist:{jti}"     │
                    └───────────────┬───────────────────────────────┘
                                    │
                         Is Token Blacklisted?
                        ┌───────────┴───────────┐
                     YES│                       │NO
                        ▼                       ▼
            [AuthenticationFailed]    ┌────────────────────────────────────────┐
             "Token has been revoked" │ 2. get_user_active_status(user_id)     │
                                      │    - Check Redis DB 2: user_active:id  │
                                      └─────────┬──────────────────────────────┘
                                                │
                                       Cache Hit or Miss?
                                    ┌───────────┴───────────┐
                          HIT (<1ms)│                       │MISS (Query DB)
                                    ▼                       ▼
                           [Return Cached Status]    [Query PostgreSQL DB]
                                    │                       │ Set Cache (5 min)
                                    └───────────┬───────────┘
                                                │
                                         Is User Active?
                                      ┌─────────┴─────────┐
                                   NO │                   │ YES
                                      ▼                   ▼
                          [AuthenticationFailed]   [AUTHENTICATED & PASSED]
                          "Account is locked..."   (user, validated_token)
```

> **Vì sao phải kết hợp kiểm tra Redis Blacklist (DB 1) và Redis `is_active` Cache (DB 2) trên MỌI Request?**
> - **Chống dùng lại Token đã Logout (Security):** Mặc định, JWT Token có tính vô trạng thái (Stateless), nếu người dùng chọn Logout thì Token cũ vẫn hợp lệ cho đến khi hết 15 phút. Nhờ kiểm tra `blacklist:jti` trong Redis DB 1, hệ thống vô hiệu hóa ngay lập tức Token đã đăng xuất.
> - **Khóa tài khoản tức thì mà không chậm DB (High Performance NFR-04):** Khi một nhân viên bị đình chỉ công tác / sa thải, Admin khóa tài khoản (`is_active = False`). Nhờ Redis DB 2 cache trạng thái `is_active` trong 5 phút (`TTL = 300s`), mọi API call của user này bị vô hiệu hóa ngay lập tức mà không cần tốn 15-30ms truy vấn PostgreSQL ở mỗi request.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Thư Viện Cache & JWT Core

```python
from django.core.cache import cache
# Cú pháp `from <module> import <tên>`: chỉ kéo đúng tên "cache" vào file này (nếu viết `import django.core.cache`
# thì phải gọi dài `django.core.cache.cache` mỗi lần dùng — from-import cho phép gọi tắt).
# "cache" viết thường = 1 INSTANCE (object) Django đã khởi tạo sẵn (singleton), KHÔNG PHẢI class.
# -> Mọi file trong project import "cache" đều đang cầm chung đúng 1 kết nối, không ai tự tạo instance riêng.
# Instance này được cấu hình trỏ tới Redis DB 2 thông qua biến CACHES trong settings.py.

from rest_framework.exceptions import AuthenticationFailed
# "AuthenticationFailed" là 1 CLASS Exception của DRF (kế thừa từ APIException), không phải hàm hay biến.
# Cứ ở đâu trong code gọi `raise AuthenticationFailed("...")`, DRF sẽ tự bắt exception loại này ở tầng framework
# và tự convert thành response HTTP 401 Unauthorized kèm message JSON — mình không cần tự viết try/except bắt nó.

from rest_framework_simplejwt.authentication import JWTAuthentication
# "JWTAuthentication" là class xác thực JWT chuẩn của gói SimpleJWT.
# Import class này về vì 2 class bên dưới sẽ kế thừa (extends) nó bằng cú pháp `class X(JWTAuthentication):`.
# Bản thân class cha này đã tự lo việc giải mã token, verify chữ ký bằng SECRET_KEY, và kiểm tra hạn dùng (exp).

from .redis_client import redis_client
# Dấu chấm "." đứng ngay trước tên module là RELATIVE IMPORT (import tương đối):
# nghĩa là "lấy từ file redis_client.py nằm CÙNG thư mục accounts/ với file này", khác với import tuyệt đối
# kiểu `from accounts.redis_client import redis_client`. Cách viết tương đối giúp app accounts/ tự chứa (self-contained).
# "redis_client" (chữ thường) cũng là 1 instance kết nối có sẵn, trỏ riêng tới Redis DB 1 (dùng để lưu blacklist token).
```

---

### 2. Class 1: `BlacklistAwareJWTAuthentication` (Kiểm Tra Token Đã Logout)

```python
# Rejects any token whose jti has been blacklisted in Redis after logout.
class BlacklistAwareJWTAuthentication(JWTAuthentication):
# Cú pháp kế thừa (inheritance): tên trong dấu ngoặc () là CLASS CHA (parent class).
# Class con tự động "thừa hưởng" mọi method của JWTAuthentication, ở đây chỉ override đúng 1 method bên dưới.
# Ví von: thuê lại căn nhà đã có sẵn nội thất, chỉ sửa lại đúng 1 cái cửa, không xây lại từ đầu.

    # Validates the token signature/expiry via super(), then rejects it if its jti is blacklisted.
    def get_validated_token(self, raw_token):
    # "self" là tham số bắt buộc đầu tiên của MỌI instance method -> Python tự truyền vào, trỏ tới chính
    # instance đang gọi hàm (mình không tự tay truyền self khi gọi obj.get_validated_token(token)).
    # Tên hàm này trùng khớp chính xác với method đã có ở JWTAuthentication (class cha) -> gọi là OVERRIDE
    # (Python không cần từ khóa @Override như Java, cứ trùng tên là tự động ghi đè).

        validated_token = super().get_validated_token(raw_token)
        # BƯỚC 1: `super()` trả về 1 PROXY OBJECT đại diện cho class cha (JWTAuthentication), KHÔNG phải tạo
        # object mới. Gọi super().get_validated_token(...) để chạy đúng bản gốc của class cha: giải mã token,
        # verify chữ ký bằng SECRET_KEY và kiểm tra hạn dùng (exp).
        # Lưu ý: nếu ở đây viết `self.get_validated_token(...)` thay vì `super()...` thì hàm sẽ tự gọi lại
        # chính nó mãi mãi -> RecursionError (đệ quy vô hạn).

        jti = validated_token["jti"]
        # "jti" (JWT ID): Mã định danh duy nhất của mỗi chiếc Token phát ra.
        # Dấu ngoặc vuông [...] là SUBSCRIPT ACCESS (giống truy cập dict bằng my_dict["key"]).
        # validated_token thực chất là object Token của SimpleJWT có cài đặt __getitem__ nên viết được như dict
        # dù nó không phải dict thuần. Nếu key "jti" không tồn tại -> Python ném KeyError (không bắt riêng ở đây).

        if redis_client.exists(f"blacklist:{jti}"):
            raise AuthenticationFailed("Token has been revoked.")
        # BƯỚC 2: `f"blacklist:{jti}"` là F-STRING (Python 3.6+) — chữ f trước dấu " báo Python evaluate biểu
        # thức trong {...} rồi nhúng giá trị vào chuỗi tại runtime (vd jti="abc" -> "blacklist:abc").
        # `.exists()` của redis-py trả về kiểu int (0 hoặc số dương), không phải bool, nhưng Python coi mọi số
        # khác 0 là truthy nên viết thẳng trong if vẫn đúng, không cần so sánh == 1.
        # `raise` NGẮT LUỒNG THỰC THI NGAY LẬP TỨC -> dòng return bên dưới sẽ không bao giờ chạy tới nếu vào nhánh này.
        # Chuỗi truyền vào AuthenticationFailed(...) là tham số `detail`, DRF tự convert thành JSON response HTTP 401.

        return validated_token
        # Nếu Token sạch (không rơi vào nhánh raise ở trên) -> trả về token hợp lệ cho nơi gọi (super().authenticate()).
```

---

### 3. Cấu Hình Cache Trạng Thái Kích Hoạt (`is_active`)

```python
_ACTIVE_CACHE_PREFIX = "user_active:"
# Dấu gạch dưới "_" đứng đầu tên biến là QUY ƯỚC của Python (không phải luật cứng của trình thông dịch):
# báo cho lập trình viên khác biết "biến này chỉ dùng nội bộ trong module, đừng import dùng từ file khác".
# Python không có từ khóa final/const như Java -> đây là hợp đồng quân tử, không phải ràng buộc kỹ thuật.
# Tiền tố key lưu trong Redis (VD: key lưu trạng thái user ID 10 là "user_active:10").

_ACTIVE_CACHE_TTL = 300
# Thời gian sống của Cache (Time-To-Live) = 300 giây (5 phút), đơn vị giây theo API của Django cache.
# Sau 300s, Redis TỰ ĐỘNG xóa key này -> không cần code nào chủ động dọn dẹp, request kế tiếp sẽ cache-miss.


# Returns is_active from Redis cache; falls back to a DB query on cache miss.
def get_user_active_status(user_id):
# Đây là HÀM CẤP MODULE (module-level function), không nằm trong class nào nên không có tham số self.
# Khác với method ở Class 1, hàm này được gọi trực tiếp kiểu get_user_active_status(5).
# Chiến lược Cache-Aside: đọc Cache trước, hụt Cache (cache miss) mới đọc DB rồi ghi lại vào Cache.

    cache_key = f"{_ACTIVE_CACHE_PREFIX}{user_id}"
    # 2 biểu thức {...} liên tiếp trong 1 f-string, Python tự nối chuỗi lại.
    # Nếu user_id=5 (kiểu int), Python tự gọi str(5) ngầm để ghép -> kết quả "user_active:5", không cần tự ép kiểu.

    cached = cache.get(cache_key)
    # Contract của Django cache API: nếu key không tồn tại (hoặc hết TTL), .get() trả về None mặc định,
    # KHÔNG ném exception -> đây là lý do dòng if bên dưới phải xét None chứ không coi thiếu key là lỗi.

    if cached is not None:
        return cached
        # TRƯỜNG HỢP 1 (Cache Hit): Tìm thấy trạng thái trong Redis DB 2 -> Trả về ngay lập tức (< 1ms).
        # LƯU Ý CÚ PHÁP QUAN TRỌNG: vì sao dùng `is not None` chứ không viết gọn `if cached:`?
        # Vì giá trị hợp lệ mà cache có thể trả về là False (tài khoản bị khóa) -> False cũng "falsy" giống
        # hệt None trong Python. Nếu viết `if cached:`, 1 tài khoản đang bị khóa (cache lưu đúng False) sẽ bị
        # hiểu nhầm thành "cache miss" -> code chạy tiếp xuống DB, mất hết lợi ích cache cho đúng case quan
        # trọng nhất. Toán tử `is` so sánh DANH TÍNH object (identity), an toàn hơn `==` cho việc so với None.

    # TRƯỜNG HỢP 2 (Cache Miss): Không tìm thấy trong Cache -> Truy vấn CSDL PostgreSQL.
    from accounts.models import CustomUser
    # Import này nằm BÊN TRONG thân hàm, không ở đầu file -> gọi là LOCAL IMPORT / LAZY IMPORT, cố ý để né
    # CIRCULAR IMPORT: authentication.py được Django nạp rất sớm (lúc đọc DEFAULT_AUTHENTICATION_CLASSES
    # trong settings.py), trước khi app registry load xong toàn bộ models. Import CustomUser ở đầu file có
    # thể ném lỗi "Apps aren't loaded yet". Đặt trong hàm khiến nó chỉ chạy KHI HÀM ĐƯỢC GỌI THỰC SỰ, lúc đó
    # app registry chắc chắn đã sẵn sàng.

    try:
        is_active = CustomUser.objects.values_list("is_active", flat=True).get(pk=user_id)
        # Đọc trái sang phải theo kiểu METHOD CHAINING (mỗi hàm trả về object mới để gọi tiếp hàm sau):
        # .objects       -> Manager mặc định của Django ORM, cổng vào để query bảng CustomUser.
        # .values_list("is_active", flat=True) -> chỉ SELECT đúng 1 cột is_active (SQL nhẹ hơn SELECT *).
        #   Mặc định values_list trả tuple mỗi dòng (vd (True,)); flat=True báo "chỉ 1 cột, bung thẳng giá
        #   trị ra" -> kết quả cuối là True/False trần, không phải (True,).
        # .get(pk=user_id) -> lấy đúng 1 bản ghi theo khóa chính (pk = alias chuẩn Django cho cột id).
        #   Không tìm thấy -> ném CustomUser.DoesNotExist; tìm thấy >1 -> ném MultipleObjectsReturned
        #   (không xảy ra với pk vì primary key luôn duy nhất).
    except CustomUser.DoesNotExist:
        return False
        # "DoesNotExist" KHÔNG phải exception có sẵn của Python, mà là class exception được Django TỰ ĐỘNG
        # sinh ra riêng cho từng Model (CustomUser.DoesNotExist khác Project.DoesNotExist).
        # Nếu user bị xóa khỏi CSDL -> Trả về False.

    cache.set(cache_key, is_active, timeout=_ACTIVE_CACHE_TTL)
    # Tham số thứ 3 truyền theo dạng KEYWORD ARGUMENT (timeout=...) thay vì vị trí (positional), giúp dễ đọc
    # và tránh nhầm thứ tự tham số. .set() nhận (key, value, timeout) -> lưu kết quả vừa lấy từ DB vào Redis
    # 5 phút để các request sau đọc thẳng từ cache.

    return is_active


# Updates the cache immediately when an admin locks or unlocks an account.
def set_user_active_status(user_id, is_active):
    cache.set(f"{_ACTIVE_CACHE_PREFIX}{user_id}", is_active, timeout=_ACTIVE_CACHE_TTL)
    # Hàm này chỉ có 1 dòng thân hàm và KHÔNG có return -> Python tự động trả về None khi hàm kết thúc.
    # Chấp nhận được vì hàm chỉ "làm hành động" (side effect: ghi cache), không cần trả kết quả cho nơi gọi.
    # Cập nhật ngay lập tức giá trị Cache khi Admin bấm khóa / mở khóa tài khoản (Write-Through Cache).


# Removes the cache entry so the next request reads the value fresh from the DB.
def invalidate_user_active_status(user_id):
    cache.delete(f"{_ACTIVE_CACHE_PREFIX}{user_id}")
    # Tương tự hàm trên, không return -> None ngầm định. .delete() xóa hẳn key khỏi Redis (không phải set None),
    # buộc request tiếp theo gọi get_user_active_status() phải cache-miss và đọc dữ liệu mới nhất từ CSDL.
```

---

### 4. Class 2: `WorkTrackerJWTAuthentication` (Lớp Xác Thực Chính Toàn Hệ Thống)

```python
# Extends BlacklistAwareJWTAuthentication with an is_active check via Redis cache (NFR-04).
# This is the class used in DEFAULT_AUTHENTICATION_CLASSES.
class WorkTrackerJWTAuthentication(BlacklistAwareJWTAuthentication):
# KẾ THỪA 2 TẦNG (multi-level inheritance): class này kế thừa BlacklistAwareJWTAuthentication, mà class đó lại
# kế thừa JWTAuthentication. Khi gọi super() bên trong class này, Python tìm theo MRO (Method Resolution
# Order): nhảy lên BlacklistAwareJWTAuthentication TRƯỚC, không nhảy thẳng lên JWTAuthentication -> logic
# blacklist ở Class 1 chắc chắn chạy trước khi tới đoạn kiểm tra is_active ở đây (giống 3 thế hệ ông-cha-con,
# mỗi đời chỉ "hỏi" đời ngay trên mình, không nhảy cóc).
# Lớp được khai báo trong settings.py làm DEFAULT_AUTHENTICATION_CLASSES cho toàn bộ dự án.

    # Runs blacklist check via super(), then verifies the user is still active before allowing the request.
    def authenticate(self, request):
    # "authenticate(self, request)" KHÔNG phải tên hàm tự đặt tùy ý, mà là method có tên BẮT BUỘC theo
    # CONTRACT của Django REST Framework: bất kỳ class nào muốn dùng làm Authentication class trong
    # DEFAULT_AUTHENTICATION_CLASSES đều phải implement đúng tên method này. DRF tự gọi nó cho MỌI request.
    # Contract quy định đúng 3 khả năng trả về, hàm này minh họa đủ cả 3:
    #   1. return None            -> "tôi không xác thực được bằng cách này, thử class tiếp theo" (không phải lỗi)
    #   2. return (user, auth)    -> xác thực thành công, DRF gán request.user = user
    #   3. raise AuthenticationFailed(...) -> chặn request ngay với HTTP 401, không thử class nào khác nữa

        result = super().authenticate(request)
        # BƯỚC 1: gọi lên BlacklistAwareJWTAuthentication (thực chất chạy tiếp lên JWTAuthentication gốc vì
        # Class 1 không override authenticate, chỉ override get_validated_token). Kết quả trả về đúng 1 trong
        # 3 khả năng ở trên.

        if result is None:
            return None
            # Dùng `is None` (không phải `if not result`) vì đang so sánh tường minh với đúng 1 giá trị
            # sentinel cụ thể là None -> thói quen an toàn khi có thể có giá trị falsy khác gây nhầm lẫn.
            # Nếu Request không đính kèm Header Authorization -> Trả về None để DRF xử lý theo Unauthenticated.

        user, validated_token = result
        # TUPLE UNPACKING (giải nén tuple): result là 1 tuple 2 phần tử (user, token), Python tự gán từng
        # phần tử vào từng biến theo đúng thứ tự vị trí. Nếu result không có đúng 2 phần tử -> Python ném
        # ValueError: too many/not enough values to unpack.

        if not get_user_active_status(user.id):
            raise AuthenticationFailed(
                "Account is locked or deactivated.", code="account_inactive"
            )
            # BƯỚC 2: dùng `not` (phủ định truthy) chứ KHÔNG dùng `is not None`, vì get_user_active_status()
            # luôn trả về đúng True/False (không bao giờ trả None) -> phủ định trực tiếp là an toàn và đúng ý.
            # `code="account_inactive"` là keyword argument thêm vào bên cạnh message: AuthenticationFailed
            # (kế thừa APIException) hỗ trợ tham số code để frontend phân biệt bằng mã lỗi ổn định
            # (error.code === "account_inactive") thay vì phải so sánh cả câu message tiếng Anh dễ đổi.
            # Nếu is_active=False (tài khoản đã bị Admin khóa) -> Chặn đứng request với HTTP 401.

        return user, validated_token
        # BƯỚC 3: viết `a, b` không có dấu ngoặc () bên ngoài vẫn tự động tạo thành 1 TUPLE (Python gọi là
        # "tuple packing" — dấu phẩy mới là thứ quyết định tạo tuple, không phải dấu ngoặc). Dòng này tương
        # đương return (user, validated_token), khớp đúng khả năng số 2 của contract authenticate() ở trên.
```

---

### 5. Cách DRF Gọi Tuần Tự Các Authentication Class (`self.authenticators`)

Trong `settings.py` của project:

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.WorkTrackerJWTAuthentication",
    ),
    ...
}
```

`DEFAULT_AUTHENTICATION_CLASSES` là 1 **tuple** — hiện tại project chỉ khai báo đúng 1 phần tử, nhưng cơ chế của
DRF luôn hỗ trợ **nhiều class xếp theo thứ tự**, ví dụ nếu sau này thêm `SessionAuthentication` thì sẽ viết
`("accounts.authentication.WorkTrackerJWTAuthentication", "rest_framework.authentication.SessionAuthentication")`
— **thứ tự khai báo trong tuple chính là thứ tự DRF sẽ thử từng class**.

Đây là đoạn code gốc thật trong `rest_framework/views.py` và `rest_framework/request.py` (lấy từ `.venv` của
project, không phải diễn giải lại) cho thấy cơ chế đó:

```python
# rest_framework/views.py — dựng danh sách instance authenticator cho mỗi request
def get_authenticators(self):
    return [auth() for auth in self.authentication_classes]
    # List comprehension: với MỖI class trong DEFAULT_AUTHENTICATION_CLASSES, gọi `auth()` để KHỞI TẠO
    # (instantiate) 1 instance mới. Vì vậy WorkTrackerJWTAuthentication được new lên MỘT LẦN cho MỖI request
    # (không tái sử dụng instance cũ giữa các request) -> an toàn vì class không giữ state riêng giữa các lần gọi.
```

```python
# rest_framework/request.py — vòng lặp thực sự quyết định "gọi tuần tự"
def _authenticate(self):
    for authenticator in self.authenticators:
    # Duyệt lần lượt TỪNG authenticator theo ĐÚNG thứ tự đã khai báo trong DEFAULT_AUTHENTICATION_CLASSES.
    # Với project hiện tại, self.authenticators chỉ có 1 phần tử: [WorkTrackerJWTAuthentication instance].

        try:
            user_auth_tuple = authenticator.authenticate(self)
            # Gọi đúng method authenticate(self, request) mà mình đã mổ xẻ ở section 4.
        except exceptions.APIException:
            self._not_authenticated()
            raise
            # Nếu authenticator RAISE lỗi (vd AuthenticationFailed khi token bị revoke hoặc account bị khóa)
            # -> DỪNG VÒNG LẶP NGAY, không thử các authenticator còn lại nữa, exception "bay" thẳng lên DRF
            # exception handler để convert thành response HTTP 401. `raise` không kèm gì phía sau nghĩa là
            # "re-raise nguyên vẹn exception vừa bắt được" (re-raise), không tạo exception mới.

        if user_auth_tuple is not None:
            self._authenticator = authenticator
            self.user, self.auth = user_auth_tuple
            return
            # Nếu authenticator này TRẢ VỀ tuple (không phải None) -> coi như xác thực THÀNH CÔNG bằng đúng
            # class này -> gán request.user, request.auth rồi `return` THOÁT LUÔN vòng lặp, không cần thử
            # các authenticator còn lại (dù có khai báo thêm class khác trong tuple).

    self._not_authenticated()
    # Chỉ chạy tới đây nếu vòng lặp `for` đi hết TẤT CẢ authenticator mà không có class nào trả về non-None
    # (mọi class đều trả None) -> gán self.user = AnonymousUser(), self.auth = None (xem _not_authenticated()).
    # Đây KHÔNG phải lỗi ở bước authenticate -> request vẫn "đi tiếp" bình thường, nhưng tới bước
    # DEFAULT_PERMISSION_CLASSES (IsAuthenticated trong settings.py project này) sẽ kiểm tra
    # request.user.is_authenticated là False -> lúc đó mới chặn bằng HTTP 401/403.
```

**Điểm quan trọng cần nhớ (tóm tắt cơ chế "gọi tuần tự"):**

1. `self.authenticators` không phải danh sách cố định toàn cục — nó được **tạo mới cho mỗi request** bởi
   `get_authenticators()`, theo đúng thứ tự trong `DEFAULT_AUTHENTICATION_CLASSES`.
2. `request.user` là 1 **lazy property** (xem `@property def user(self):` trong `request.py`) — vòng lặp
   `_authenticate()` ở trên **không tự chạy khi request tới**, nó chỉ chạy vào **lần đầu tiên** có code nào đó
   đọc `request.user` (thường là do `IsAuthenticated` permission class gọi, hoặc code trong view tự truy cập).
   Sau lần đầu, kết quả được cache vào `self._user` nên các lần đọc sau không chạy lại vòng lặp.
3. Có đúng 3 kết cục cho mỗi authenticator khi được gọi — khớp chính xác với "contract 3 khả năng" đã nói ở
   section 4: `None` → thử class kế tiếp; tuple `(user, auth)` → dừng vòng lặp, coi là thành công; `raise` →
   dừng vòng lặp ngay, thất bại toàn bộ request (không thử class còn lại dù có khai báo thêm).
4. Với project hiện tại chỉ có 1 class (`WorkTrackerJWTAuthentication`) nên "tuần tự" ở đây thực chất chỉ có
   đúng 1 bước — nhưng nếu sau này thêm class thứ 2 (vd cho phép login qua session cho trang admin Django),
   cơ chế vòng lặp này chính là thứ quyết định class nào được ưu tiên thử trước.

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Thành Phần Code | Bộ Lưu Trữ (Storage Layer) | Chiến Lược / Cơ Chế Báo Lỗi | Mục Đích Nghiệp Vụ & Kỹ Thuật |
|-------------------|-----------------------------|-----------------------------|-----------------------------|
| **`BlacklistAwareJWTAuthentication`** | Redis DB 1 (`blacklist:jti`) | HTTP 401 `"Token has been revoked"` | Lập tức vô hiệu hóa Token đã Logout mà không đợi token tự hết hạn 15 phút |
| **`get_user_active_status`** | Redis DB 2 (`user_active:id`) | Cache-Aside (TTL 5 phút) | Tránh đập SQL vào PostgreSQL ở mọi request API, đáp ứng NFR-04 |
| **`set_user_active_status`** | Redis DB 2 | Write-Through Cache Update | Cập nhật tức thì khi Admin khóa/mở tài khoản nhân viên |
| **`invalidate_user_active_status`** | Redis DB 2 | Cache Invalidation | Xóa sạch cache khi có biến động dữ liệu user |
| **`WorkTrackerJWTAuthentication`** | Combined (Redis DB 1 + DB 2) | HTTP 401 `account_inactive` | Class xác thực mặc định toàn ứng dụng (Kiểm tra Token + Blacklist + User Active) |
