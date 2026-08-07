# ProjectManagerApp — Kiến Thức 08: Modern Java, Thuật Toán & Bảo Mật

> File code liên quan: `TaskFactory.java`, `ProjectService.java` (`reverseOrder()`,
> `findDuplicateIds()`), `PasswordHasher.java`
> (xem `ProjectManagerApp_Guide_03_Service.md`, `Guide_04_Utils_Session.md`)

---

## 1. Switch Expression (Java 14+) — `TaskFactory.create()`

```java
public class TaskFactory {
    public static Task create(String type, String id, String title, String description,
                               String priority, String status, String extra) {
        return switch (type.toUpperCase()) {
            case "BUG" -> new Bug(id, title, description, priority, status, extra);
            case "FEATURE" -> new Feature(id, title, description, priority, status,
                                           Integer.parseInt(extra));
            default -> throw new IllegalArgumentException("Loai task khong hop le: " + type);
        };
    }
}
```

### `switch` Cũ (Statement) vs `switch` Mới (Expression)

**Cách cũ** (Java trước bản 14, gọi là `switch` **statement** — chỉ THỰC HIỆN hành động, không TRẢ
VỀ giá trị):

```java
// CÁCH CŨ — dài dòng, dễ quên "break"
Task result;
switch (type.toUpperCase()) {
    case "BUG":
        result = new Bug(id, title, description, priority, status, extra);
        break;                          // QUÊN break → "rơi" (fall-through) xuống case kế tiếp!
    case "FEATURE":
        result = new Feature(id, title, description, priority, status, Integer.parseInt(extra));
        break;
    default:
        throw new IllegalArgumentException("Loai task khong hop le: " + type);
}
return result;
```

**Cách mới** (`switch` **expression** — Java 14+, dùng `->`, TRẢ VỀ một giá trị trực tiếp):

```java
return switch (type.toUpperCase()) {
    case "BUG" -> new Bug(...);
    case "FEATURE" -> new Feature(...);
    default -> throw new IllegalArgumentException("Loai task khong hop le: " + type);
};
```

| | `switch` statement (cũ) | `switch` expression (mới, `->`) |
|---|---|---|
| Có trả về giá trị? | Không (chỉ thực hiện lệnh) | **Có** — `return switch (...) { ... }` |
| Cần `break`? | **Có**, nếu quên → fall-through (lỗi ngầm rất phổ biến) | **Không** — mỗi case tự "kết thúc" sau `->` |
| Cú pháp | `case "BUG": ...; break;` | `case "BUG" -> ...;` |
| Nhiều dòng trong 1 case? | Tự nhiên (nhiều câu lệnh) | Cần `{ ... yield giaTri; }` |
| Bắt buộc xử lý hết trường hợp (exhaustive)? | Không | **Có**, nếu thiếu `default` (với kiểu không phải enum đầy đủ) → lỗi compile |

→ `switch` expression **an toàn hơn**: không có khái niệm "rơi xuyên case" (fall-through) — đây là
một trong những lỗi runtime khó debug nhất của Java cũ (quên 1 dấu `break;`, code vẫn compile bình
thường, nhưng chạy sai).

### Tại Sao Đây Là "Factory Pattern" (Nhắc Lại `KienThuc_02`)

```java
Task t = TaskFactory.create("bug", "T01", "Loi crash", "...", "HIGH", "OPEN", "Crash khi luu");
```

- `type.toUpperCase()` — **chuẩn hóa input**: dù người dùng gõ `"bug"`, `"Bug"`, hay `"BUG"`, switch
  vẫn match đúng case `"BUG"`. Đây là lý do nên chuẩn hóa **TRƯỚC KHI** so sánh, thay vì viết
  `case "bug"`, `case "Bug"`, `case "BUG"` lặp lại 3 lần.
- `default -> throw new IllegalArgumentException(...)` — nếu `type` không phải `"BUG"` hay
  `"FEATURE"`, **ném exception ngay tại đây** — lỗi được phát hiện **sớm, tại nơi tạo object**, thay
  vì để `null` "trôi" xuống các tầng dưới rồi gây `NullPointerException` ở một nơi xa, khó truy vết
  (liên hệ `KienThuc_04` — exception giúp lỗi "lộ ra" ngay tại nguồn).

---

## 2. Thuật Toán Two Pointer — `reverseOrder()`

```java
public void reverseOrder() {
    synchronized (lock) {
        int left = 0;
        int right = list.size() - 1;
        while (left < right) {
            T temp = list.get(left);
            list.set(left, list.get(right));
            list.set(right, temp);
            left++;
            right--;
        }
    }
}
```

### Two Pointer Là Gì?

"Two Pointer" (2 con trỏ) là kỹ thuật dùng **2 biến chỉ số** (`left`, `right`) **chạy từ 2 đầu** của
danh sách, **tiến lại gần nhau**, để xử lý dữ liệu **chỉ trong 1 lần lặp duy nhất** — thay vì lặp
nhiều lần hoặc tạo danh sách phụ.

### Trace Qua Ví Dụ: `list = [A, B, C, D, E]`

```
Bước 0:  [A, B, C, D, E]     left=0(A)              right=4(E)
         → swap list[0] và list[4]
         [E, B, C, D, A]     left=1                 right=3
                                  ▲                       ▲
Bước 1:  [E, B, C, D, A]     left=1(B)              right=3(D)
         → swap list[1] và list[3]
         [E, D, C, B, A]     left=2                 right=2
                                     ▲▲
Bước 2:  left == right == 2  → while (left < right) là FALSE → DỪNG

Kết quả: [E, D, C, B, A]   ✔ đã đảo ngược hoàn toàn
```

- **Điều kiện dừng `left < right`**: khi `left == right` (phần tử giữa, danh sách lẻ) hoặc
  `left > right` (vừa vượt qua nhau, danh sách chẵn) — **không cần swap thêm**, vì phần tử ở giữa
  giữ nguyên vị trí khi đảo ngược, và các cặp còn lại đã được swap hết.
- Mỗi vòng lặp: `left++` và `right--` → 2 con trỏ **tiến về nhau** → vòng lặp chạy đúng
  `n/2` lần (với `n = list.size()`).

### Độ Phức Tạp — Tại Sao Cách Này "Tốt"?

| Cách làm | Thời gian | Bộ nhớ phụ |
|---|---|---|
| **Two Pointer (code trên)** | O(n) — mỗi phần tử chạm đúng 1 lần | O(1) — chỉ 1 biến `temp`, không tạo list mới |
| Tạo `List` mới, `for` từ cuối về đầu, `add()` vào list mới | O(n) | O(n) — tốn thêm bộ nhớ cho list mới |
| `Collections.reverse(list)` (có sẵn trong Java) | O(n) | O(1) — **thực ra bên trong cũng dùng Two Pointer!** |

→ `Collections.reverse()` của Java **chính là** cài đặt Two Pointer này — viết lại bằng tay ở đây
**để học thuật toán**, không phải vì `Collections.reverse()` không dùng được. `T temp = ...` —
`temp` cần thiết để **không làm mất giá trị** `list.get(left)` trước khi ghi đè bằng
`list.get(right)` (kỹ thuật "swap 3 bước" kinh điển: lưu tạm → gán A=B → gán B=tạm).

> **Tại sao trong `synchronized(lock)`?** Đã giải thích ở `KienThuc_06` — `reverseOrder()` **sửa
> đổi `list`** (gọi `list.set(...)`) — nếu luồng khác đang đọc/sửa `list` cùng lúc → dữ liệu hỏng
> hoặc `ConcurrentModificationException`.

---

## 3. Phát Hiện Trùng Lặp Với `HashSet` — `findDuplicateIds()` (LeetCode #217)

```java
public List<String> findDuplicateIds() {
    synchronized (lock) {
        Set<String> seen = new HashSet<>();
        List<String> duplicates = new ArrayList<>();
        for (T task : list) {
            if (!seen.add(task.id)) {
                duplicates.add(task.id);
            }
        }
        return duplicates;
    }
}
```

### Liên Hệ LeetCode #217 "Contains Duplicate"

Đề bài kinh điển: "Cho 1 danh sách số, kiểm tra có số nào **xuất hiện từ 2 lần trở lên** không?"
`findDuplicateIds()` là biến thể: "Trả về **danh sách các `id` bị trùng**" (không chỉ true/false).

### "Mánh" Cốt Lõi: `Set.add()` Trả Về `boolean`

```java
Set<String> seen = new HashSet<>();
seen.add("T01");        // → true  (chưa có "T01" trong set → THÊM thành công)
seen.add("T02");        // → true  (chưa có "T02" → THÊM thành công)
seen.add("T01");        // → false (ĐÃ CÓ "T01" rồi → KHÔNG thêm, set không đổi)
```

`HashSet.add(x)` trả về:
- **`true`** nếu `x` **CHƯA CÓ** trong set (và đã thêm thành công).
- **`false`** nếu `x` **ĐÃ CÓ** trong set (set không đổi — vì `Set` không cho phần tử trùng).

→ `if (!seen.add(task.id))` đọc là: *"Nếu THÊM `task.id` vào `seen` mà THẤT BẠI (tức `id` này ĐÃ
TỪNG xuất hiện trước đó) → đây là 1 bản ghi trùng → thêm vào `duplicates`."*

### Trace Qua Ví Dụ: `list` có id = `[T01, T02, T03, T01, T02]`

| Bước | `task.id` | `seen.add(id)` trả về | `seen` sau đó | `duplicates` sau đó |
|---|---|---|---|---|
| 1 | T01 | `true` (mới) | `{T01}` | `[]` |
| 2 | T02 | `true` (mới) | `{T01, T02}` | `[]` |
| 3 | T03 | `true` (mới) | `{T01, T02, T03}` | `[]` |
| 4 | T01 | `false` (đã có!) | `{T01, T02, T03}` | `[T01]` |
| 5 | T02 | `false` (đã có!) | `{T01, T02, T03}` | `[T01, T02]` |

**Kết quả:** `duplicates = [T01, T02]`.

### Tại Sao Dùng `HashSet` Mà Không Dùng "2 Vòng `for` Lồng Nhau"?

```java
// CÁCH "BRUTE FORCE" — 2 vòng for lồng nhau, O(n²)
List<String> duplicates = new ArrayList<>();
for (int i = 0; i < list.size(); i++) {
    for (int j = i + 1; j < list.size(); j++) {
        if (list.get(i).id.equals(list.get(j).id) && !duplicates.contains(list.get(i).id)) {
            duplicates.add(list.get(i).id);
        }
    }
}
```

| | `HashSet` (code thật) | 2 vòng `for` lồng nhau |
|---|---|---|
| Độ phức tạp | **O(n)** — mỗi phần tử chỉ duyệt 1 lần, `HashSet.add()` là O(1) | **O(n²)** — với 1.000 task → ~1.000.000 phép so sánh |
| Độ dễ đọc | Ngắn, rõ ý định ("kiểm tra đã thấy chưa") | Dài, lồng nhau, dễ viết sai điều kiện |

→ Đây chính là lý do **HashMap/HashSet** được nhấn mạnh ở `KienThuc_03`: bài toán "đã từng thấy
X chưa?" — nếu dùng `List.contains()` (O(n) mỗi lần gọi) trong vòng lặp → tổng O(n²); dùng
`HashSet.add()`/`.contains()` (O(1) mỗi lần) trong vòng lặp → tổng O(n). **Đổi cấu trúc dữ liệu**
(List → Set) có thể biến thuật toán từ "chậm" thành "nhanh" mà **không cần thuật toán phức tạp**.

---

## 4. Bảo Mật Mật Khẩu — SHA-256 + Base64 (`PasswordHasher`)

```java
public class PasswordHasher {

    public static String hash(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new AppException("Loi khi hash mat khau: " + e.getMessage());
        }
    }
}
```

### Tại Sao KHÔNG Lưu Mật Khẩu Dạng Văn Bản Thuần (Plain Text)?

```sql
-- TUYỆT ĐỐI KHÔNG làm thế này:
INSERT INTO Users (username, password) VALUES ('admin', 'admin123');
```

Nếu database bị lộ (hack, backup file rò rỉ, nhân viên DBA xem trộm...), **toàn bộ mật khẩu của mọi
user bị lộ ngay lập tức** — và vì nhiều người **dùng lại** cùng 1 mật khẩu cho nhiều tài khoản
(email, ngân hàng...), hậu quả lan rộng ra ngoài phạm vi app này.

### Hashing Là Gì? — "Hàm Một Chiều" (One-Way Function)

```
"admin123"  ──(SHA-256)──▶  "JL0AmCNvOcCQaLak..."  (chuỗi 256-bit, dạng Base64)
    │                              │
    │                              ▼
    │                    KHÔNG THỂ đảo ngược lại "admin123"
    │                    (không có hàm "unhash")
    ▼
Database CHỈ lưu chuỗi hash này — KHÔNG bao giờ lưu "admin123"
```

- **Hashing** ≠ **Encryption** (mã hóa). Encryption có thể **giải mã** (decrypt) để lấy lại dữ liệu
  gốc (cần "khóa"). Hashing là **một chiều** — không có cách nào (về lý thuyết) để từ hash suy ra
  lại mật khẩu gốc.
- **Cùng input → luôn cùng output**: `hash("admin123")` luôn ra **đúng 1 chuỗi cố định** mỗi lần
  gọi — đây là tính chất **deterministic** (xác định), cần thiết để **so sánh khi đăng nhập**.

### Cơ Chế Đăng Nhập Với Password Đã Hash

```java
// Khi REGISTER (đăng ký):
String hashedPassword = PasswordHasher.hash("admin123");   // → "JL0AmCNvOcCQaLak..."
// Lưu hashedPassword vào DB — KHÔNG lưu "admin123"

// Khi LOGIN (đăng nhập):
String inputHash = PasswordHasher.hash(loginRequest.getPassword());  // hash mật khẩu user vừa gõ
if (inputHash.equals(user.getPasswordHash())) {   // so sánh 2 CHUỖI HASH, không so sánh password gốc
    // đăng nhập thành công
}
```

→ Hệ thống **không bao giờ cần biết** mật khẩu gốc là gì — chỉ cần kiểm tra **2 hash có khớp
nhau** hay không. Vì cùng input luôn cho cùng hash, nếu user gõ đúng `"admin123"`, `hash(...)` sẽ
ra **đúng chuỗi đã lưu trong DB** lúc đăng ký.

### `MessageDigest.getInstance("SHA-256")` — Vì Sao Có `try/catch NoSuchAlgorithmException`?

```java
try {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    ...
} catch (NoSuchAlgorithmException e) {
    throw new AppException("Loi khi hash mat khau: " + e.getMessage());
}
```

- `MessageDigest.getInstance("SHA-256")` — Java cho phép chỉ định **tên thuật toán** bằng `String`
  (`"SHA-256"`, `"MD5"`, `"SHA-1"`...) — đây là API kiểu "tra cứu theo tên". Nếu gõ sai tên
  (`"SHA-2566"`) hoặc máy chạy thiếu "security provider", Java ném `NoSuchAlgorithmException` —
  một **checked exception** (`KienThuc_04`) — **bắt buộc** phải `try/catch` hoặc `throws`.
- Trong thực tế, `"SHA-256"` **luôn có sẵn** trong mọi JVM chuẩn — exception này gần như **không
  bao giờ xảy ra**. Vì vậy code "dịch" nó thành `AppException` (unchecked, `KienThuc_04`) — nếu lỗi
  này xảy ra, đó là **lỗi cấu hình môi trường nghiêm trọng**, không phải lỗi logic có thể "xử lý và
  tiếp tục" — nên không cần ép caller của `hash()` phải `try/catch`.

### `digest.digest(password.getBytes(StandardCharsets.UTF_8))` — Từng Bước

```
"admin123"  (String)
    │  .getBytes(StandardCharsets.UTF_8)
    ▼
[97, 100, 109, 105, 110, 49, 50, 51]   (byte[] — mã UTF-8 của từng ký tự)
    │  digest.digest(...)
    ▼
[0x24, 0x5D, 0x00, 0x98, ...]          (byte[] — 32 byte = 256 bit, "vân tay" của input)
```

- `.getBytes(StandardCharsets.UTF_8)` — String trong Java lưu dưới dạng `char` (UTF-16 trong bộ
  nhớ); `MessageDigest` cần `byte[]` — `.getBytes(UTF_8)` chuyển String → bytes theo chuẩn UTF-8
  (luôn chỉ định rõ encoding, tránh phụ thuộc vào "default charset" của hệ điều hành — vốn có thể
  khác nhau giữa Windows/Linux, gây hash khác nhau cho cùng 1 password!).
- `digest.digest(bytes)` — chạy thuật toán SHA-256, luôn trả về `byte[]` dài **đúng 32 byte**
  (256 bit), bất kể input dài hay ngắn.

### `Base64.getEncoder().encodeToString(hashBytes)` — Tại Sao Cần Base64?

```
byte[] (32 byte nhị phân, có thể chứa byte "không in được")
    │  Base64.getEncoder().encodeToString(...)
    ▼
"JL0AmCNvOcCQaLak3WtR9hYz..."   (String — chỉ gồm A-Z, a-z, 0-9, +, /, =)
```

`byte[]` là dữ liệu **nhị phân thô** — có thể chứa các byte không phải ký tự text bình thường (ví
dụ byte `0x00`, `0xFF`...) → nếu in trực tiếp ra màn hình, lưu vào cột `VARCHAR` trong SQL, hay
truyền qua JSON/XML, sẽ **gây lỗi hoặc hiển thị sai** (ký tự lạ, dấu hỏi `?`). **Base64** "dịch"
mọi `byte[]` thành 1 chuỗi **chỉ gồm ký tự an toàn** (`A-Z a-z 0-9 + / =`) — có thể lưu thẳng vào
cột `VARCHAR`/`NVARCHAR` (`KienThuc_05`), in ra log, copy-paste, mà không lo lỗi ký tự.

> **Lưu ý:** Base64 **KHÔNG phải mã hóa** — ai cũng có thể "decode" Base64 ngược lại thành
> `byte[]` ban đầu (đây là phép biến đổi **công khai**, không có "khóa bí mật"). Tính an toàn của
> `PasswordHasher` nằm hoàn toàn ở **SHA-256 là hàm một chiều** — Base64 chỉ là bước "đóng gói" để
> hash dễ lưu trữ/hiển thị dưới dạng text.

### Bảng Tổng Kết: Mã Băm Sẵn Có Trong `Guide_04`

| Mật khẩu gốc | Hash SHA-256 + Base64 (lưu trong DB) |
|---|---|
| `admin123` | (chuỗi cố định — luôn giống nhau mỗi lần hash) |
| `user123` | (chuỗi cố định khác — khác `admin123` dù chỉ khác vài ký tự) |

→ Chỉ cần **thay đổi 1 ký tự** trong input, kết quả hash **hoàn toàn khác** (tính chất gọi là
"avalanche effect" — hiệu ứng lan tỏa) — đây là lý do hash **không thể** dùng để "đoán" hay "suy
luận" ra password gốc dù chỉ biết gần đúng.

---

## 5. Tổng Kết Toàn Bộ Series `KienThuc_00` → `KienThuc_08`

| File | Nội dung chính | "Từ khóa" cần nhớ |
|---|---|---|
| `00_TongQuan` | Kiến trúc phân lớp (UI → Service → Repository → DB) | Layered Architecture, Separation of Concerns |
| `01_OOP_KeThua_Interface` | Class, Encapsulation, Abstract, Inheritance, Polymorphism, Interface | `extends`, `abstract`, `instanceof`, Interface Segregation |
| `02_DesignPatterns` | Singleton, Factory, Template Method, DAO | `getInstance()`, `synchronized`, `final` method |
| `03_Generic_Collection` | Generic `<T extends Task>`, HashMap, ArrayList, HashSet, Stream | Bounded type, O(1) lookup, dual structure |
| `04_ExceptionHandling` | try/catch/finally, checked/unchecked, custom exception | `AppException`, exception translation |
| `05_JDBC_Database` | Connection, PreparedStatement, ResultSet, SQL schema | SQL Injection, `try-with-resources`, `Types.XXX` |
| `06_Multithreading` | Thread, JavaFX UI Thread, race condition, `synchronized` | `Platform.runLater`, daemon thread, lock object |
| `07_JavaFX_CoBan` | FXML, `@FXML`, Scene, TableView, CSS | `fx:id`, `fx:controller`, CellValueFactory, `styleClass` |
| `08_ModernJava_Algorithm_Security` (file này) | `switch` expression, Two Pointer, HashSet trùng lặp, SHA-256 | `->`, `seen.add()`, hash một chiều |

### Cách Học Hiệu Quả Với Series Này

1. **Đọc lần lượt 00 → 08** — mỗi file xây dựng trên kiến thức của file trước (ví dụ: hiểu
   `synchronized` ở `06` cần đã hiểu `ProjectService` ở `03`).
2. **Đối chiếu với code thật** trong các file `Guide_0X_*.md` — mỗi đoạn code trong `KienThuc_*`
   đều trích trực tiếp từ `Guide_*`, có thể tìm lại context đầy đủ.
3. **Tự đặt câu hỏi "tại sao"** trước khi đọc phần giải thích — ví dụ: "Tại sao `UserSession` không
   có `getInstance()`?", "Tại sao `reverseOrder()` cần `synchronized`?" — rồi kiểm tra câu trả lời
   của mình với nội dung file.
4. **Thử "phá" rồi sửa**: ví dụ thử bỏ `synchronized`, bỏ `break` trong switch cũ, đổi
   `PreparedStatement` thành ghép chuỗi SQL — quan sát lỗi xảy ra để hiểu rõ "tại sao cần".

Series này tổng hợp **toàn bộ kiến thức nền tảng** để hiểu (và sau này tự code lại) một ứng dụng
desktop Java hoàn chỉnh: từ OOP/Design Pattern (cách tổ chức code), Generic/Collection (cách lưu
trữ dữ liệu trong bộ nhớ), Exception (cách xử lý lỗi), JDBC (cách giao tiếp với database),
Multithreading (cách giữ UI mượt mà), JavaFX (cách xây giao diện), đến thuật toán và bảo mật cơ
bản (cách viết code đúng và an toàn).
