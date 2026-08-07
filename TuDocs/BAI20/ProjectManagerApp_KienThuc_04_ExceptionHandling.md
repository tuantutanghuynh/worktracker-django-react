# ProjectManagerApp — Kiến Thức 04: Exception Handling (try/catch/finally, Custom Exception)

> File code liên quan: `AppException.java`, `Validator.java`, `PasswordHasher.java`,
> `ProjectService.Add()`, `AuthService.java`, `LoginController.java`
> (xem `ProjectManagerApp_Guide_04_Utils_Session.md`, `Guide_03_Service.md`, `Guide_05_Controllers.md`)

---

## 1. Exception Là Gì? (Cho Người Chưa Biết Gì)

**Exception (ngoại lệ)** là một **object đặc biệt** được Java tạo ra khi có điều gì đó **bất thường**
xảy ra trong lúc chương trình chạy — ví dụ: chia cho 0, truy cập phần tử không tồn tại, kết nối
database thất bại, người dùng nhập "abc" vào ô chỉ nhận số...

Khi exception xảy ra, Java **dừng việc thực thi bình thường** và "ném" (throw) object exception đó
**đi tìm nơi xử lý**. Nếu không ai xử lý → chương trình **crash** (dừng đột ngột, in ra "stack
trace" đỏ chữ chi chít).

```java
String s = null;
System.out.println(s.length());   // → NullPointerException: gọi method trên object null
```

### Tại sao không nên để chương trình "crash"?

Trong `LoginController`, nếu user nhập username rỗng và bấm "Dang Nhap" mà không có exception
handling, app có thể **đóng sập** hoặc hiện màn hình lỗi xấu xí của Java — trải nghiệm rất tệ.
**Exception handling** cho phép bạn "bắt" lỗi này và **hiển thị thông báo thân thiện**
(`"Username khong duoc de trong."`) thay vì crash.

---

## 2. `try / catch / finally` — Cấu Trúc Cơ Bản

```java
try {
    // code CÓ THỂ ném exception
} catch (LoaiExceptionNaoDo e) {
    // code XỬ LÝ khi exception đó xảy ra
} finally {
    // code LUÔN CHẠY — dù try thành công hay catch được kích hoạt
}
```

### Ví dụ thật từ `ProjectService.Add()`

```java
public boolean Add(T task) {
    try {
        if (task == null) throw new NullPointerException("Task khong duoc null");
        if (map.containsKey(task.id))
            throw new IllegalArgumentException("ID \"" + task.id + "\" da ton tai");
        if (!repo.insert(task))
            throw new RuntimeException("Luu xuong DB that bai");

        synchronized (lock) {
            map.put(task.id, task);
            list.add(task);
        }
        return true;

    } catch (Exception e) {
        System.out.println("[ERROR] " + e.getMessage());
        return false;

    } finally {
        System.out.println("[LOG] Them task ket thuc.");
    }
}
```

### Đi Từng Bước — 3 Tình Huống Có Thể Xảy Ra

**Tình huống A: Mọi thứ OK** (task không null, ID chưa tồn tại, insert DB thành công)
```
1. Chạy hết try { } — không có throw nào xảy ra
2. return true  ← chuẩn bị trả về true...
3. ...NHƯNG TRƯỚC KHI THỰC SỰ RETURN, finally { } chạy → in "[LOG] Them task ket thuc."
4. Sau đó mới thực sự return true ra ngoài
```

**Tình huống B: ID đã tồn tại** (`map.containsKey(task.id)` = true)
```
1. throw new IllegalArgumentException("ID \"B001\" da ton tai")
2. Nhảy NGAY tới catch (Exception e) — bỏ qua phần còn lại của try
3. In "[ERROR] ID \"B001\" da ton tai"
4. return false  ← chuẩn bị trả về false...
5. finally chạy → in "[LOG] Them task ket thuc."
6. Sau đó mới thực sự return false ra ngoài
```

**Tình huống C: `task == null`**
```
1. throw new NullPointerException("Task khong duoc null")
2. Nhảy tới catch (Exception e) — NullPointerException LÀ MỘT Exception (kế thừa từ Exception)
   → catch (Exception e) bắt được luôn (xem mục 3 dưới)
3. In "[ERROR] Task khong duoc null"
4. return false
5. finally chạy → in "[LOG] Them task ket thuc."
```

### `finally` — "Dù Thế Nào, Việc Này VẪN PHẢI LÀM"

`finally` luôn được thực thi, **bất kể**:
- `try` chạy trót lọt không lỗi.
- `try` ném exception và `catch` đã xử lý.
- (Thậm chí) `try`/`catch` có `return` — `finally` vẫn chạy **trước khi** giá trị return thực sự
  được trả ra ngoài.

**Khi nào dùng `finally`?** Cho các hành động **"phải làm dù kết quả ra sao"** — ví dụ:
- Ghi log ("đã thử thêm task, kết quả ra sao cũng phải ghi lại là đã thử") — như trong
  `ProjectService.Add()`.
- Đóng file, đóng kết nối network (trong project này, `Connection` là Singleton dùng suốt app nên
  không đóng ở đây — nhưng đây là use-case kinh điển của `finally`).

---

## 3. Phân Cấp Exception trong Java — Vì Sao `catch (Exception e)` Bắt Được Cả 3 Loại Lỗi?

```
                    Throwable
                   /          \
              Error          Exception
           (lỗi nghiêm trọng,    |
            VD: OutOfMemory —    |
            KHÔNG nên catch)     |
                        ┌────────┴─────────┐
                        |                  |
              RuntimeException      (Checked Exceptions:
              (Unchecked)            IOException, SQLException...)
              /        |        \
   NullPointerException  IllegalArgumentException  ArithmeticException
                              |
                       AppException (custom — định nghĩa trong project)
```

`catch (Exception e)` bắt được **bất kỳ exception nào kế thừa (trực tiếp hoặc gián tiếp) từ
`Exception`** — bao gồm `RuntimeException`, `NullPointerException`,
`IllegalArgumentException`, `AppException`,... vì tất cả đều **"là một"** `Exception` (quan hệ
is-a, xem `KienThuc_01`).

### Checked vs Unchecked Exception — Khác Biệt Quan Trọng

| | **Checked Exception** | **Unchecked Exception** |
|---|---|---|
| Ví dụ | `SQLException`, `IOException` | `RuntimeException`, `NullPointerException`, `IllegalArgumentException` |
| Compiler bắt buộc? | **Có** — method ném checked exception PHẢI khai báo `throws ...` hoặc `try/catch` | **Không** — có thể ném mà không cần khai báo gì |
| Ví dụ trong project | `TaskRepository.insert()` dùng `try (PreparedStatement ps = ...) { } catch (SQLException e) { ... }` — bắt buộc vì `SQLException` là checked | `Validator.requireNonBlank()` ném `IllegalArgumentException` — không cần `throws` trong chữ ký method |

```java
// SQLException là CHECKED — bắt buộc try/catch hoặc throws
public boolean insert(Task t) {
    String sql = "INSERT INTO Tasks ...";
    try (PreparedStatement ps = conn.prepareStatement(sql)) {  // có thể ném SQLException
        ...
        return true;
    } catch (SQLException e) {           // PHẢI catch (hoặc method này phải "throws SQLException")
        System.out.println("[REPO] Insert loi: " + e.getMessage());
        return false;
    }
}
```

```java
// IllegalArgumentException là UNCHECKED — KHÔNG cần throws/try-catch để compile
public static void requireNonBlank(String value, String field) {
    if (value == null || value.isBlank())
        throw new IllegalArgumentException(field + " khong duoc de trong.");
    // method này KHÔNG cần "throws IllegalArgumentException" trong chữ ký
}
```

> **Triết lý:** Checked exception dùng cho lỗi **bên ngoài, có thể xảy ra dù code đúng** (DB mất kết
> nối, file không tồn tại — *"môi trường gây ra"*). Unchecked exception dùng cho lỗi **do lập trình
> sai/dữ liệu đầu vào sai** (*"logic/người dùng gây ra"*) — Java không ép `try/catch` vì những lỗi
> này **thường nên được NGĂN CHẶN bằng validate**, không phải "bắt rồi cho qua".

---

## 4. `throw` vs `throws` — Dễ Nhầm

- **`throw`** (động từ, không có "s"): dùng **bên trong code** để "ném ra" 1 exception cụ thể ngay
  lúc đó.
  ```java
  throw new IllegalArgumentException("Username khong duoc de trong.");
  ```
- **`throws`** (có "s"): dùng trong **chữ ký method** (sau tên method) để khai báo "method này CÓ
  THỂ ném ra loại exception này — ai gọi tôi phải lo việc bắt nó".
  ```java
  private void handleLogin() throws IOException { ... }
  //                          ^^^^^^^^^^^^^^^^^^
  // SceneSwitcher.switchScene() có thể ném IOException (checked) → handleLogin() khai báo "throws"
  // thay vì tự try/catch — "đẩy" trách nhiệm catch lên cho người gọi (ở đây là JavaFX framework)
  ```

---

## 5. Custom Exception — `AppException`

```java
package com.projectmanager.exceptions;

public class AppException extends RuntimeException {

    public AppException(String message) {
        super(message);              // gọi constructor của RuntimeException
    }

    public AppException(String message, Throwable cause) {
        super(message, cause);       // "cause" = exception GỐC gây ra lỗi này
    }
}
```

### Vì sao tự định nghĩa 1 class Exception mới?

Java đã có sẵn rất nhiều exception (`RuntimeException`, `IllegalArgumentException`,
`NullPointerException`,...) — nhưng đôi khi bạn muốn **phân loại lỗi theo Ý NGHĨA NGHIỆP VỤ riêng
của app**, để code đọc vào biết ngay "đây là loại lỗi gì của app này".

```java
public static String hash(String password) {
    try {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(password.getBytes("UTF-8"));
        return Base64.getEncoder().encodeToString(digest);
    } catch (Exception e) {
        throw new AppException("Hash error: " + e.getMessage(), e);
        //                                                       ^
        //                                            "e" = exception GỐC (NoSuchAlgorithmException
        //                                            hoặc UnsupportedEncodingException) — giữ lại
        //                                            để debug, không "nuốt mất" thông tin gốc
    }
}
```

### `AppException` vs `IllegalArgumentException` — Phân Biệt Theo "AI GÂY RA LỖI"

| | `IllegalArgumentException` | `AppException` |
|---|---|---|
| Ai gây ra lỗi? | **Người dùng/caller** truyền sai tham số (validate input) | **Hệ thống nội bộ** (SHA-256 không khả dụng — *gần như không thể xảy ra* trên máy thật, nhưng API `MessageDigest.getInstance()` buộc bạn xử lý) |
| Có thể "tự sửa" bằng cách nhập lại không? | **Có** — user sửa input và submit lại | **Không** — đây là lỗi môi trường/cấu hình, user sửa input cũng vô ích |
| Dùng ở đâu | `Validator.*`, `AuthService.register()` (username trùng, password không khớp) | `PasswordHasher.hash()` |

Việc **phân loại exception theo nguồn gốc lỗi** giúp tầng trên (`Controller`) quyết định
**message hiển thị khác nhau** cho user — xem mục 7.

---

## 6. `Validator` — Biến Lỗi "Khó Hiểu" Thành Message UI-Friendly

```java
public class Validator {

    private Validator() {}   // utility class — không khởi tạo (giống TaskFactory, PasswordHasher)

    public static void requireNonBlank(String value, String field) {
        if (value == null || value.isBlank())
            throw new IllegalArgumentException(field + " khong duoc de trong.");
    }

    public static void requireMinLength(String value, String field, int min) {
        if (value != null && value.length() < min)
            throw new IllegalArgumentException(field + " phai co it nhat " + min + " ky tu.");
    }

    // Parse và validate CÙNG LÚC — ném IllegalArgumentException thay vì NumberFormatException
    public static int parsePositiveInt(String raw, String field) {
        try {
            int v = Integer.parseInt(raw.trim());
            if (v <= 0) throw new IllegalArgumentException(field + " phai lon hon 0.");
            return v;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(field + " phai la so nguyen hop le.");
        }
    }
}
```

### Điểm Đáng Học: "Bắt 1 Exception, Ném Ra 1 Exception KHÁC, Dễ Hiểu Hơn"

`Integer.parseInt("abc")` ném `NumberFormatException` — một exception "kỹ thuật", message của nó
(`For input string: "abc"`) **không thân thiện** để hiển thị trực tiếp cho user Việt Nam.

`parsePositiveInt()` **bắt** `NumberFormatException` (kỹ thuật) rồi **ném lại** thành
`IllegalArgumentException` với message **"So gio phai la so nguyen hop le."`** — dễ hiểu, có thể
hiển thị trực tiếp lên `lblMessage`.

> Đây gọi là **"exception translation"** (dịch exception) — chuyển exception ở tầng thấp (kỹ thuật,
> chi tiết implementation) thành exception ở tầng cao (ý nghĩa nghiệp vụ, người dùng hiểu được).

### Cách Dùng Trong `AddTaskController`

```java
try {
    Validator.requireNonBlank(id,    "Task ID");
    Validator.requireNonBlank(title, "Tieu de");
    Validator.requireOneOf(priority, "Priority", "LOW", "MEDIUM", "HIGH");
    if (isBug) Validator.requireOneOf(severity, "Severity", "LOW","MEDIUM","HIGH","CRITICAL");
    else       hours = Validator.parsePositiveInt(txtHours.getText(), "So gio");
    // ...
} catch (IllegalArgumentException e) {
    showMsg(e.getMessage(), false);  // hiển thị trên lblMessage màu đỏ
}
```

Mỗi `Validator.xxx()` **ném exception NGAY KHI gặp lỗi đầu tiên** — các dòng `Validator.xxx()` phía
sau **sẽ không chạy** (vì `throw` nhảy ngay tới `catch`). Điều này tạo ra cách kiểm tra "tuần tự,
dừng lại ở lỗi đầu tiên" — đơn giản, dễ debug (user thấy lần lượt từng lỗi một, sửa xong lỗi 1 mới
thấy lỗi 2).

---

## 7. Luồng Xử Lý Lỗi Đầy Đủ — Từ `LoginController` Đến UI

```java
@FXML
private void handleLogin() throws IOException {
    try {
        User u = authService.login(new LoginRequest(
            txtUsername.getText().trim(),
            txtPassword.getText()
        ));

        if (u == null)  { showMsg("Sai username hoac mat khau.", false); return; }
        if (!u.status)  { showMsg("Tai khoan bi khoa. Lien he admin.", false); return; }

        UserSession.set(u);
        SceneSwitcher.switchScene("dashboard.fxml");

    } catch (IllegalArgumentException e) {
        showMsg(e.getMessage(), false);
    } catch (Exception e) {
        showMsg("Loi he thong: " + e.getMessage(), false);
    }
}
```

Chú ý: **2 catch block, theo thứ tự cụ thể → tổng quát**:

```
catch (IllegalArgumentException e)   ← cụ thể hơn, ĐỨNG TRƯỚC
catch (Exception e)                  ← tổng quát hơn, ĐỨNG SAU (bắt "mọi thứ còn lại")
```

**Thứ tự BẮT BUỘC**: Java yêu cầu catch block cho exception **cụ thể (con)** phải đứng **trước**
catch block cho exception **tổng quát (cha)**. Nếu viết ngược lại (`catch (Exception e)` trước,
`catch (IllegalArgumentException e)` sau) → **lỗi compile** ("unreachable catch block" — vì
`Exception` đã "vợt" hết mọi loại rồi, dòng sau không bao giờ chạy tới).

### Toàn Cảnh — Lỗi Đi Từ Đâu Đến Đâu

```
LoginController.handleLogin()
       │
       ├─ Validator.requireNonBlank() trong AuthService.login()
       │     → throws IllegalArgumentException("Username khong duoc de trong.")
       │     → catch (IllegalArgumentException e) → showMsg(e.getMessage(), false)
       │            hiển thị: "Username khong duoc de trong." (màu đỏ, dễ hiểu)
       │
       ├─ PasswordHasher.hash() bên trong AuthService (nếu SHA-256 lỗi — hiếm)
       │     → throws AppException("Hash error: ...")
       │     → AppException EXTENDS RuntimeException → KHÔNG khớp catch (IllegalArgumentException)
       │     → rơi xuống catch (Exception e) → showMsg("Loi he thong: Hash error: ...", false)
       │
       └─ authService.login() trả về null (không throw gì — chỉ return null)
             → if (u == null) → showMsg("Sai username hoac mat khau.", false)
```

→ **3 loại lỗi khác nhau** (input sai / lỗi hệ thống / không tìm thấy user) → **3 cách phản hồi
khác nhau** — nhưng người dùng cuối **luôn thấy 1 dòng message rõ ràng trên `lblMessage`**, không
bao giờ thấy "stack trace" đỏ chữ của Java.

---

## 8. `e.getMessage()` vs `e.printStackTrace()` — Dùng Khi Nào?

```java
// Trong Repository — log đầy đủ stack trace để DEVELOPER debug (không hiển thị cho user)
catch (SQLException e) { e.printStackTrace(); }

// Trong Controller — chỉ lấy message ngắn để hiển thị cho USER
catch (IllegalArgumentException e) { showMsg(e.getMessage(), false); }
```

- `e.getMessage()` — trả về **chuỗi message ngắn** bạn truyền vào khi `throw new XxxException("...")`.
  Phù hợp để hiển thị trên UI.
- `e.printStackTrace()` — in ra **toàn bộ "đường đi"** của exception (class nào, method nào, dòng
  nào gây ra lỗi, exception nào gọi exception nào...) — **rất dài, kỹ thuật**, chỉ hữu ích cho
  **developer khi debug**, KHÔNG nên hiển thị cho user cuối.

> Trong `TaskRepository`/`UserRepository`, lỗi SQL dùng `e.printStackTrace()` vì đây là lỗi **tầng
> dưới** (developer cần biết chi tiết để sửa schema/SQL) — còn `AddTaskController`,
> `LoginController` dùng `e.getMessage()` vì đây là lỗi **tầng trên** (cần hiển thị cho user).

---

## 9. Tóm Tắt — Checklist Khi Viết Exception Handling

1. **Validate input SỚM** (`Validator.requireNonBlank`...) — ném `IllegalArgumentException` với
   message rõ ràng bằng tiếng Việt → hiển thị trực tiếp được cho user.
2. **Custom exception (`AppException`)** cho lỗi hệ thống nội bộ — phân biệt rõ với lỗi do user.
3. **`try-with-resources`** (`try (PreparedStatement ps = ...)`) cho mọi resource cần đóng (sẽ học kỹ
   ở `KienThuc_05`).
4. **`finally`** cho hành động "luôn phải làm" (logging...).
5. Catch **cụ thể trước, tổng quát sau** — không bao giờ chỉ `catch (Exception e)` ở MỌI nơi (sẽ
   "nuốt" hết lỗi, khó debug).
6. **Không hiển thị `e.printStackTrace()` cho user** — chỉ dùng `e.getMessage()` đã qua "dịch" bởi
   `Validator`/`AppException`.

---

**Tiếp theo:** `ProjectManagerApp_KienThuc_05_JDBC_Database.md` — Java giao tiếp với SQL Server qua
JDBC như thế nào, và tại sao `PreparedStatement` (với `?`) lại quan trọng đến mức "bắt buộc dùng".
