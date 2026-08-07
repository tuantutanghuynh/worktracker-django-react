# Executive Code Annotation: `backend/accounts/serializers_auth.py`

**Package / Module:** `backend.accounts.serializers_auth` · Authentication Serializers & Token Issuer

> **Cách đọc tài liệu này:** Coi mỗi khối code dưới đây như một trang truyện tranh có phụ đề —
> mọi dòng code đều có một dòng `#` đi kèm giải thích 3 lớp nghĩa: (1) cú pháp Python/Django đó *làm gì*,
> (2) dấu ngoặc/toán tử/kiểu dữ liệu đó *nghĩa là gì*, và (3) dòng đó đang *làm việc gì trong nghiệp vụ quản lý nhân sự & chấm công WorkTracker*.
> Chỗ nào khó hình dung, mình chêm thêm vị von đời thường (căn nhà, chìa khóa, vé xem phim, sổ cái, tủ đồ, công tắc...)
> để dễ nhớ hơn là học thuộc lòng thuật ngữ.

---

## Sơ Đồ Xử Lý Chu Trình Xác Thực (Authentication Flow Architecture Diagram)

```
                            ┌─────────────────────────────────┐
                            │    Frontend Auth Operations     │
                            └────────────────┬────────────────┘
                                             │
      ┌──────────────────────────────┬───────┴──────────────────────────────┬──────────────────────────────┐
      │                              │                                      │                              │
      ▼                              ▼                                      ▼                              ▼
┌───────────┐                  ┌───────────┐                          ┌───────────┐                  ┌───────────┐
│   Login   │                  │  Forgot   │                          │   Reset   │                  │  Change   │
│Serializer │                  │Password S.│                          │Password S.│                  │Password S.│
└─────┬─────┘                  └─────┬─────┘                          └─────┬─────┘                  └─────┬─────┘
      │                              │                                      │                              │
      │ 1. Validate Email/Pass       │ 1. Gen Secrets Token (32 bytes)      │ 1. Check token valid/unused  │ 1. Check current password
      │ 2. Issue Access + Refresh    │ 2. Save PasswordReset (TTL 15m)      │ 2. Update user.password      │ 2. Update user.password
      │ 3. Include claims & perms    │ 3. Return record for Mailer          │ 3. Mark token is_used=True   │ 3. Clear must_change_password
      ▼                              ▼                                      ▼                              ▼
┌───────────┐                  ┌───────────┐                          ┌───────────┐                  ┌───────────┐
│ Token Payload                 │ Email Reset Link                     │ Password Updated             │ Password Changed
│ (User + Perms)                │ (No User Enum Leak)                  │ (Single-use Token)           │ (Unblocks User)
└───────────┘                  └───────────┘                          └───────────┘                  └───────────┘
```

> **Vì sao thông báo lỗi đăng nhập sai email và sai mật khẩu phải GIỐNG NHAU ("Invalid email or password")?**
> Đây là quy tắc bảo mật chống dò quét người dùng (**Anti User-Enumeration**). Nếu báo "Email không tồn tại", kẻ tấn công sẽ biết được danh sách các email có tài khoản trong công ty. Việc trả về chung một câu báo lỗi khiến kẻ xấu không thể phân biệt được email nào đã tồn tại trong hệ thống.

---

## Giải Thích Chi Tiết Từng Dòng Code (Line-by-Line Code Annotation)

### 1. Import Thư Viện Serializer & Security Core

```python
from django.contrib.auth import get_user_model
# "get_user_model()" là 1 HÀM, không phải import trực tiếp class User -> gọi HÀM này (có dấu ngoặc () ở dưới,
# dòng `User = get_user_model()`) để lấy đúng class Model User đang được khai báo trong settings.py
# (AUTH_USER_MODEL = "accounts.CustomUser"). Dùng hàm này thay vì `from accounts.models import CustomUser`
# giúp file này KHÔNG PHỤ THUỘC CỨNG vào tên "CustomUser" -> nếu sau này đổi tên Model User, code này vẫn chạy
# đúng mà không cần sửa gì, đây là pattern chuẩn của Django khuyến nghị khi dùng custom user model.

from rest_framework import serializers
# Import cả MODULE "serializers" (không phải từng class lẻ) -> phải gọi qua tiền tố serializers.Serializer,
# serializers.EmailField, serializers.ValidationError... Cách import này giúp code đọc rõ nguồn gốc mỗi class
# đến từ đâu, tránh trùng tên với class tự định nghĩa trong project.

from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
# Import 2 tên cùng lúc, cách nhau bằng dấu phẩy trong cùng 1 dòng from-import.
# AuthenticationFailed -> DRF tự convert thành HTTP 401 (bạn CHƯA xác thực được / sai thông tin đăng nhập).
# PermissionDenied     -> DRF tự convert thành HTTP 403 (bạn ĐÃ xác thực đúng nhưng KHÔNG được phép, vd bị khóa).
# Phân biệt rõ 2 mã lỗi này là chủ đích thiết kế của cả file, không phải ngẫu nhiên.

from rest_framework_simplejwt.tokens import RefreshToken
# "RefreshToken" là 1 CLASS, dùng qua classmethod `RefreshToken.for_user(user)` bên dưới (không tạo instance
# bằng RefreshToken() trực tiếp) -> đây là ALTERNATIVE CONSTRUCTOR pattern, sẽ giải thích kỹ ở section 2.

import secrets
# Cú pháp `import <module>` (không có "from") -> phải gọi qua tiền tố đầy đủ `secrets.token_urlsafe(...)`.
# "secrets" là thư viện CHUẨN của Python (built-in, không cần cài thêm), chuyên sinh số/chuỗi ngẫu nhiên với
# độ an toàn mật mã (CSPRNG - Cryptographically Secure PRNG). KHÔNG dùng module "random" cho việc bảo mật vì
# random.random() có thể bị dự đoán được (không an toàn cho token reset password).

from datetime import timedelta
# "timedelta": kiểu dữ liệu đại diện cho 1 KHOẢNG THỜI GIAN (vd 15 phút), dùng để CỘNG vào 1 mốc thời gian
# (datetime) bằng toán tử "+" thông thường ở section 3 (timezone.now() + timedelta(minutes=15)).

from django.utils import timezone
# Import "timezone" của DJANGO, KHÔNG PHẢI "datetime" của Python thuần. Khác biệt quan trọng:
# timezone.now() trả về datetime CÓ TIMEZONE (timezone-aware, theo USE_TZ trong settings.py), còn
# datetime.datetime.now() trả về "naive datetime" (không gắn timezone) -> nếu lỡ trộn 2 loại này khi so sánh
# hoặc lưu DB sẽ gây lỗi/lệch giờ khó phát hiện. Quy tắc: trong Django luôn dùng timezone.now(), không dùng
# datetime.now() trực tiếp.

from .models import PasswordReset, RolePermission
# Relative import (dấu "." đầu) lấy 2 Model từ file models.py CÙNG package accounts/.

User = get_user_model()
# Gán kết quả gọi hàm vào biến module-level "User" (viết hoa chữ đầu theo quy ước đặt tên CLASS trong Python,
# dù về bản chất đây chỉ là 1 biến trỏ tới class). Dòng này CHỈ CHẠY ĐÚNG 1 LẦN khi module được import lần đầu,
# rồi mọi nơi trong file (LoginSerializer, ForgotPasswordSerializer...) đều dùng chung biến "User" này để query.
```

---

### 2. Class 1: `LoginSerializer` (Xác Thực & Phát Hành JWT)

```python
# Validates email/password and issues JWT access/refresh tokens on success.
class LoginSerializer(serializers.Serializer):
# Kế thừa `serializers.Serializer` (KHÔNG PHẢI ModelSerializer) vì input (email, password) không map 1-1
# vào 1 Model cụ thể nào để save() -- serializer này chỉ dùng để VALIDATE input rồi tự chạy logic riêng
# (get_tokens), không có ý định tạo/sửa bản ghi DB nào từ chính field của nó.

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    # Đây là KHAI BÁO FIELD Ở CẤP CLASS (class attribute), không phải instance attribute.
    # DRF dùng 1 cơ chế metaclass ở "phía sau" để tự động quét mọi field khai báo kiểu này và gom vào 1 dict
    # nội bộ `self.fields` cho từng instance -> đây là lý do bạn "khai báo như thuộc tính" nhưng lại hoạt
    # động như một danh sách field động, không phải 2 biến class dùng chung giữa các instance.
    # "write_only=True" = Mật khẩu chỉ được ĐỌC từ input JSON gửi lên, không bao giờ xuất hiện trong output
    # JSON trả về (kể cả khi serialize lại object) -> tránh vô tình leak password ra response.

    def __init__(self, *args, **kwargs):
    # `*args` gom mọi THAM SỐ VỊ TRÍ (positional) không đặt tên vào 1 TUPLE; `**kwargs` gom mọi THAM SỐ CÓ TÊN
    # (keyword) vào 1 DICT. Đây gọi là "variadic parameters" -- cho phép __init__ này nhận được BẤT KỲ tham
    # số nào mà serializers.Serializer gốc chấp nhận (vd data=..., context=...), mà không cần liệt kê hết ra.
        super().__init__(*args, **kwargs)
        # Dấu "*" và "**" ở đây làm ngược lại: UNPACK tuple/dict đã gom được ở trên ra thành các tham số rời
        # rồi truyền tiếp cho __init__ gốc của serializers.Serializer -> đảm bảo mọi logic khởi tạo chuẩn của
        # DRF (parse data, context...) vẫn chạy đầy đủ trước khi mình thêm dòng của riêng mình bên dưới.
        self.user = None
        # Khai báo self.user = None ngay trong __init__ để thuộc tính này LUÔN TỒN TẠI trên mọi instance
        # (kể cả khi validate() chưa từng được gọi) -> nhờ vậy get_tokens() bên dưới kiểm tra `self.user is
        # None` được an toàn, không sợ AttributeError vì thuộc tính chưa từng được gán.

    def validate(self, attrs):
    # "validate" là TÊN HÀM ĐẶC BIỆT được DRF Serializer TỰ ĐỘNG GỌI (không phải mình chủ động gọi tay) ngay
    # sau khi từng field (email, password) đã validate xong riêng lẻ -- đây gọi là OBJECT-LEVEL VALIDATION,
    # chạy khi code ở view gọi `serializer.is_valid()`. Tham số `attrs` là 1 dict chứa data đã qua field-level
    # validate (vd EmailField đã tự kiểm tra định dạng email hợp lệ trước khi tới đây).
        email = attrs.get("email")
        password = attrs.get("password")
        # `.get("key")` trên dict trả về None nếu key không tồn tại (KHÔNG ném lỗi), khác với `attrs["email"]`
        # (subscript) sẽ ném KeyError nếu thiếu key. Dùng .get() ở đây an toàn hơn dù thực tế 2 field đã được
        # validate là required nên hiếm khi thiếu.

        user = User.objects.filter(email=email).first()
        # `.filter(email=email)` trả về 1 QuerySet (có thể rỗng, không lỗi dù không match dòng nào).
        # `.first()` lấy phần tử đầu tiên của QuerySet đó, trả về None nếu QuerySet rỗng -- khác hẳn `.get()`
        # (sẽ ném DoesNotExist nếu không tìm thấy). Dùng .first() ở đây CỐ Ý để None hóa trường hợp email sai,
        # xử lý gộp chung với trường hợp sai password ở dòng if ngay dưới.

        if user is None or not user.check_password(password):
            raise AuthenticationFailed("Invalid email or password.")
            # Toán tử `or` có SHORT-CIRCUIT EVALUATION: nếu `user is None` là True, Python DỪNG LUÔN, không
            # chạy tiếp `not user.check_password(password)` nữa -- quan trọng vì nếu user thực sự là None mà
            # vẫn gọi user.check_password(...) sẽ ném AttributeError (None không có method check_password).
            # `.check_password()` là method của Django tự HASH password vừa nhập rồi SO SÁNH với hash đã lưu
            # trong DB theo cách chống timing-attack, KHÔNG BAO GIỜ so sánh password dạng plaintext trực tiếp.
            # Chống dò quét Email: dùng CHUNG 1 câu thông báo cho cả 2 trường hợp sai email hoặc sai password.

        if not user.is_active:
            raise PermissionDenied(
                "User account is disabled. Please contact the administrator."
            )
            # `user.is_active` là field kiểu Boolean có sẵn của Django User -> `not` phủ định trực tiếp là đủ
            # (không cần is/is not vì field này không bao giờ là None). Cố tình dùng PermissionDenied (403)
            # khác class exception với nhánh trên (AuthenticationFailed/401) để Frontend phân biệt được 2 case.

        self.user = user
        return attrs
        # `validate()` theo QUY ƯỚC BẮT BUỘC của DRF phải return lại dict attrs (có thể đã chỉnh sửa) --
        # nếu quên return, DRF sẽ coi validated_data là None và các bước sau bị lỗi.

    def get_tokens(self):
    # Đây là METHOD TỰ ĐỊNH NGHĨA, KHÔNG PHẢI 1 phần API chuẩn của DRF Serializer -- phải được VIEW chủ động
    # gọi tay SAU KHI is_valid() đã chạy xong (khác với validate() ở trên do DRF tự gọi ngầm).
        if self.user is None:
            raise RuntimeError(
                "get_tokens() called before successful validation..."
            )
            # Guard clause: chặn ngay từ đầu hàm nếu bị gọi sai thứ tự (trước khi validate() thành công),
            # ném lỗi RÕ NGHĨA thay vì để code chạy xuống dưới rồi ném AttributeError khó hiểu (self.user.email
            # trên None). Đây là kỹ thuật "fail fast" cho lỗi LẬP TRÌNH (không phải lỗi do user nhập sai).

        refresh = RefreshToken.for_user(self.user)
        # `RefreshToken.for_user(...)` là CLASSMETHOD (gọi qua tên Class, không qua instance) đóng vai trò
        # ALTERNATIVE CONSTRUCTOR: thay vì `RefreshToken()` rồi tự set user, class cung cấp sẵn 1 "lối tắt"
        # để tạo token đã gắn sẵn payload chuẩn (user_id, token_type, exp...) cho đúng user truyền vào.

        # Custom claims phải được gắn VÀO refresh token trước khi đọc `access_token`
        refresh["email"] = self.user.email
        refresh["role"] = self.user.role.code if self.user.role else None
        # `refresh["email"] = ...` là SUBSCRIPT ASSIGNMENT (gán qua dấu ngoặc vuông) -- object RefreshToken
        # cài đặt __setitem__ nên dùng được cú pháp giống dict dù nó không phải dict thuần, y hệt cách
        # validated_token["jti"] đọc được ở file authentication.py.
        # `X if <điều_kiện> else Y` là CONDITIONAL EXPRESSION (toán tử 3 ngôi của Python) -- khác thứ tự so
        # với Java (`điều_kiện ? X : Y`): Python đọc kết quả TRƯỚC, điều kiện SAU. Ở đây: nếu user có role
        # thì lấy role.code, ngược lại gán None (user chưa được Admin gán role nào).

        access = refresh.access_token
        # `.access_token` là 1 PROPERTY (không phải method, không có dấu ngoặc ()) của SimpleJWT: mỗi lần đọc
        # thuộc tính này, SimpleJWT tạo mới 1 Access Token bằng cách SAO CHÉP LẠI các claim đang có trên
        # `refresh` tại đúng thời điểm đọc. Đây là lý do 2 dòng set `refresh["email"]`/`refresh["role"]` ở
        # trên PHẢI chạy TRƯỚC dòng này -- nếu đảo thứ tự, access token sinh ra sẽ THIẾU 2 claim đó.

        perms = (
            list(
                RolePermission.objects.filter(role=self.user.role).values_list(
                    "permission__code", flat=True
                )
            )
            if self.user.role
            else []
        )
        # Cả biểu thức này là 1 CONDITIONAL EXPRESSION lớn bọc trong dấu ngoặc () để xuống dòng cho dễ đọc
        # (ngoặc () ở đây thuần túy là gom nhóm biểu thức, không tạo tuple vì không có dấu phẩy).
        # `.values_list("permission__code", flat=True)` -> dấu "__" (2 gạch dưới) là DOUBLE-UNDERSCORE LOOKUP
        # của Django ORM, nghĩa là "đi qua Foreign Key `permission` rồi lấy cột `code` của bảng liên kết" --
        # tự sinh câu SQL JOIN, không cần viết SQL tay.
        # `list(...)` bọc ngoài cùng: QuerySet vốn LAZY (chưa thực sự chạy SQL cho tới khi bị duyệt/ép kiểu),
        # gọi list() ép QuerySet THỰC THI NGAY câu SQL và trả về 1 list Python cụ thể, không phải "hứa hẹn".
        # Nếu user không có role -> nhánh else [] tránh phải query DB vô ích.

        return {
            "access": str(access),
            "refresh": str(refresh),
            # `str(access)` / `str(refresh)`: 2 object Token của SimpleJWT không phải chuỗi sẵn (chúng override
            # __str__ để tự encode payload + ký chữ ký thành chuỗi JWT chuẩn dạng "header.payload.signature"
            # khi bị ép str()) -- nếu thiếu str() ở đây, JSON response sẽ chứa repr object thay vì token thật.
            "user": {
                "id": self.user.id,
                "email": self.user.email,
                "role": self.user.role.code if self.user.role else None,
                "must_change_password": self.user.must_change_password,
                "permissions": perms,
            },
            # Dict lồng dict: đây là 1 DICT LITERAL với 3 key ở cấp ngoài (access, refresh, user), trong đó
            # value của key "user" lại là 1 dict con khác -> khi DRF/Django trả response, dict này được
            # serialize thẳng thành JSON lồng nhau tương ứng.
        }
        # Trả về bộ Token kèm thông tin User & danh sách Permissions để Frontend (React) render giao diện
        # menu theo quyền ngay lập tức, không cần tự decode JWT ở phía client.
```

---

### 3. Class 2 & 3: `ForgotPasswordSerializer` & `ResetPasswordSerializer`

```python
# Creates a one-time reset token for the given email, if that email exists.
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def creat_reset_token(self):
    # Method tự đặt tên (không phải hook có sẵn của DRF, tương tự get_tokens() ở trên) -> view phải chủ động
    # gọi tay sau khi is_valid() chạy xong.
        email = self.validated_data["email"]
        # `self.validated_data` là DICT do DRF Serializer TỰ TẠO SẴN sau khi is_valid() chạy thành công,
        # chứa data đã qua field-level validate (khác `self.data`, vốn dùng để OUTPUT/serialize object).
        # Dùng subscript [...] (không phải .get()) vì "email" chắc chắn có mặt -- field bắt buộc đã validate.

        user = User.objects.filter(email=email).first()

        if user is None:
            return None
            # Nếu email không tồn tại, trả về None IM LẶNG (không raise lỗi nào) -- đây là chủ đích, không
            # phải thiếu sót: view gọi hàm này sẽ luôn trả cùng 1 response chung cho client dù email tồn tại
            # hay không, tránh lộ (leak) thông tin "email này có tài khoản trong hệ thống hay không".

        token = secrets.token_urlsafe(32)
        # `secrets.token_urlsafe(32)` sinh ra chuỗi ngẫu nhiên từ 32 BYTES entropy, rồi encode sang dạng
        # Base64 an toàn để nhét vào URL (không chứa ký tự đặc biệt như +, /, = gây lỗi khi nhúng vào link).
        # Vì dùng module "secrets" (không phải "random") nên chuỗi này KHÔNG THỂ đoán trước được, phù hợp làm
        # token bảo mật (khác hẳn việc chỉ cần random cho mục đích không nhạy cảm như shuffle danh sách).

        return PasswordReset.objects.create(
            email=email, token=token, expires_at=timezone.now() + timedelta(minutes=15)
        )
        # `.objects.create(**fields)` = gộp 2 bước "tạo instance Model" + "gọi .save()" thành 1 lệnh duy nhất,
        # trả thẳng về bản ghi vừa lưu (khác `PasswordReset(...)` chỉ tạo object trong bộ nhớ, chưa ghi DB).
        # `timezone.now() + timedelta(minutes=15)`: toán tử "+" ở đây được OVERLOAD (nạp chồng) bởi kiểu
        # datetime -- lấy mốc thời gian HIỆN TẠI (có timezone) rồi CỘNG THÊM 1 khoảng 15 phút, ra 1 mốc
        # datetime MỚI trong tương lai, gán cho cột expires_at.
```

```python
class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.reset_record = None
        # Cùng pattern với LoginSerializer.__init__: khai báo sẵn thuộc tính = None để get/apply_new_password
        # bên dưới luôn kiểm tra `is None` an toàn, không sợ AttributeError nếu bị gọi trước validate().

    def validate(self, attrs):
        reset = PasswordReset.objects.filter(token=attrs["token"]).first()

        if reset is None:
            raise serializers.ValidationError("Invalid Token")
            # `serializers.ValidationError` (KHÁC với AuthenticationFailed/PermissionDenied ở LoginSerializer)
            # -> DRF tự convert thành HTTP 400 Bad Request, đúng ngữ nghĩa "dữ liệu bạn gửi lên không hợp lệ",
            # không phải lỗi xác thực danh tính hay lỗi phân quyền.

        if reset.is_used:
            raise serializers.ValidationError("This reset link has already been used.")

        if reset.expires_at < timezone.now():
            raise serializers.ValidationError("This reset link has expired.")
            # So sánh 2 giá trị datetime bằng toán tử "<" trực tiếp -- hoạt động được vì cả 2 vế đều là
            # datetime TIMEZONE-AWARE (expires_at lưu trong DB cũng aware nhờ USE_TZ=True); nếu lỡ so sánh
            # 1 bên aware với 1 bên naive, Python sẽ ném TypeError ngay tại đây.
            # 3 nhánh if TÁCH RIÊNG (không gộp bằng "or" như LoginSerializer) vì đây KHÔNG PHẢI chỗ cần chống
            # dò quét -- token là chuỗi 32 byte ngẫu nhiên, không đoán được, nên cho phép báo lỗi cụ thể để
            # người dùng biết chính xác vì sao link không dùng được (hết hạn/đã dùng/token sai).

        self.reset_record = reset
        return attrs

    def apply_new_password(self):
        if self.reset_record is None:
            raise RuntimeError("apply_new_password() called before successful validation...")

        user = User.objects.filter(email=self.reset_record.email).first()
        user.set_password(self.validated_data["new_password"])
        # `.set_password()` KHÔNG gán trực tiếp field password = "chuỗi mới" -- nó tự HASH chuỗi bằng thuật
        # toán băm 1 chiều (theo PASSWORD_HASHERS trong settings.py) rồi mới gán vào field. Đây là lý do luôn
        # phải gọi method này thay vì `user.password = new_password`, tránh lưu plaintext vào DB.
        user.save()
        # Bản thân set_password() chỉ đổi giá trị TRÊN INSTANCE trong bộ nhớ -- phải gọi .save() TƯỜNG MINH
        # thì thay đổi mới thực sự được ghi xuống PostgreSQL (Django models không auto-persist mỗi lần gán).

        self.reset_record.is_used = True
        self.reset_record.save()
        # Cùng nguyên tắc: gán is_used = True (đổi trong bộ nhớ) rồi phải .save() lại mới lưu DB thật.
        # Đánh dấu token đã sử dụng để không bao giờ pass qua được nhánh `if reset.is_used:` ở validate() nữa.

        return user
```

---

### 4. Class 4: `ChangePasswordSerializer` (Đổi Mật Khẩu Khi Đã Đăng Nhập)

```python
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    # Không có __init__ hay self.user riêng ở class này -- vì user cần dùng đã được xác thực SẴN bởi
    # WorkTrackerJWTAuthentication (xem file authentication.py) trước khi request tới được tới đây, nên có
    # thể lấy thẳng qua request.user mà không cần tự lưu tạm như 2 class Reset/Login ở trên.

    def validate(self, attrs):
        user = self.context["request"].user
        # `self.context` là 1 DICT được VIEW TRUYỀN VÀO khi khởi tạo serializer, kiểu:
        # `ChangePasswordSerializer(data=request.data, context={"request": request})`.
        # Đây là CƠ CHẾ CHUẨN của DRF để "bơm" thêm dữ liệu ngoài `data` (JSON body) vào cho serializer dùng
        # -- ở đây cần request.user (ai đang đăng nhập), thứ không có trong body JSON gửi lên.
        # `self.context["request"]` dùng subscript trực tiếp (không .get()) vì view LUÔN PHẢI truyền context
        # này, thiếu nó là lỗi lập trình (nên để tự ném KeyError nếu quên, dễ phát hiện khi test).

        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError("Current password is incorrect.")
            # Bắt buộc phải cung cấp ĐÚNG mật khẩu hiện tại mới cho đổi -- đây là "bằng chứng" thay thế cho
            # token (khác ResetPasswordSerializer dùng token 32-byte gửi qua email làm bằng chứng).
            # ValidationError -> HTTP 400, vì đây được coi là "input sai" chứ không phải lỗi xác thực JWT.

        return attrs

    def apply_new_password(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        # Gán trực tiếp thuộc tính Boolean = False trên instance (chỉ đổi trong bộ nhớ tại bước này).
        user.save()
        # 1 lệnh .save() DUY NHẤT lưu CẢ HAI thay đổi cùng lúc (password mới đã hash sẵn trong set_password(),
        # và must_change_password = False) -- khác ResetPasswordSerializer phải gọi .save() 2 lần cho 2 object
        # riêng biệt (user và reset_record), ở đây chỉ có 1 object user nên gộp save() 1 lần là đủ.
        # Đổi mật khẩu thành công và XÓA CỜ must_change_password -> giải phóng user khỏi bị middleware/permission
        # chặn API bắt buộc đổi mật khẩu lần đầu.
```

---

## Ghi Chú Thiết Kế (Design Summary Table)

| Class Serializer | Input Fields | Kết Quả Thực Thi (Action Output) | Cơ Chế Bảo Mật Tương Ứng |
|-------------------|--------------|----------------------------------|--------------------------|
| **`LoginSerializer`** | `email`, `password` | Cặp Access/Refresh Token + User Permissions Payload | Chống dò quét Email (Anti-enumeration), phân biệt 401 và 403 |
| **`ForgotPasswordSerializer`** | `email` | Record `PasswordReset` (Token 32-byte, TTL 15m) | Im lặng khi mail sai, dùng CSPRNG generator (`secrets`) |
| **`ResetPasswordSerializer`** | `token`, `new_password` | Đổi mật khẩu & đánh dấu `is_used = True` | Token dùng 1 lần duy nhất, kiểm tra thời gian hết hạn (`expires_at`) |
| **`ChangePasswordSerializer`** | `old_password`, `new_password` | Đổi mật khẩu & xóa cờ `must_change_password = False` | Đòi hỏi xác thực pass cũ, giải phóng cờ bị chặn permission |
