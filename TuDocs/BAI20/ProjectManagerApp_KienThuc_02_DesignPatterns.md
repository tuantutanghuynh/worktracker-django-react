# ProjectManagerApp — Kiến Thức 02: Design Patterns (Singleton, Factory, Template Method, DAO)

> File code liên quan: `DatabaseConfig.java`, `ProjectService.java`, `UserSession.java`,
> `TaskFactory.java`, `Task.java`, `TaskRepository.java`, `UserRepository.java`
> (xem `ProjectManagerApp_Guide_02_DataLayer.md`, `Guide_03_Service.md`, `Guide_04_Utils_Session.md`)

---

## 0. Design Pattern Là Gì? (Cho Người Chưa Biết Gì)

**Design Pattern (mẫu thiết kế)** là một **giải pháp đã được kiểm chứng** cho một **vấn đề lặp lại**
trong thiết kế phần mềm. Nó **không phải là code cụ thể** — nó là một "công thức/khuôn mẫu" mà bạn áp
dụng vào code của mình.

Ví dụ tương tự ngoài đời: "công thức nấu phở" là một pattern — bất kỳ ai theo công thức đó sẽ ra một
tô phở (dù nguyên liệu/chi tiết có thể khác), và người biết công thức sẽ "nhận ra ngay" đây là phở dù
nhìn vào một quán mới.

Trong `ProjectManagerApp`, có 4 pattern được dùng: **Singleton**, **Factory**, **Template Method**,
**DAO**. Ta sẽ học từng cái — vấn đề nó giải quyết, và "dấu hiệu nhận biết" trong code.

---

## 1. Singleton Pattern — "Chỉ Có Đúng 1 Instance Trong Toàn App"

### Vấn đề cần giải quyết

Có những thứ trong app **chỉ nên tồn tại DUY NHẤT MỘT LẦN**:
- 1 kết nối tới Database (mở nhiều kết nối → tốn tài nguyên, dễ lỗi).
- 1 "kho dữ liệu task" dùng chung cho mọi màn hình (nếu mỗi màn hình có bản riêng → dữ liệu không
  đồng bộ, vừa thêm task ở màn A, sang màn B không thấy).
- 1 "trạng thái đăng nhập" (user nào đang login) — không thể có 2 user "đang login" khác nhau trong
  cùng 1 lần chạy app.

### 3 Dấu hiệu nhận biết Singleton trong code Java

```java
public class DatabaseConfig {

    private static Connection connection;       // (1) field static — thuộc về CLASS, không phải OBJECT

    private DatabaseConfig() {}                  // (2) constructor private — không ai new được

    public static synchronized Connection getConnection() {   // (3) "cổng" truy cập duy nhất
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(URL, USER, PASSWORD);
        }
        return connection;
    }
}
```

1. **`private static` field** — biến này thuộc về *class* `DatabaseConfig`, chỉ có **1 bản duy nhất**
   trong toàn bộ chương trình (khác với field thường `public String id` trong `Task` — mỗi object
   `Bug` có `id` riêng của nó).
2. **Constructor `private`** — không có cách nào để viết `new DatabaseConfig()` từ bên ngoài class.
   Đây là cách Java **chặn** việc tạo nhiều instance.
3. **Method `static` công khai làm "cổng vào duy nhất"** (`getConnection()`) — đây là cách duy nhất
   để lấy ra cái instance đó.

### `static` nghĩa là gì? (Quan trọng — nền tảng để hiểu Singleton)

- Field/method **không có `static`**: thuộc về **từng object**. `bug1.id` và `bug2.id` là 2 vùng nhớ
  khác nhau.
- Field/method **có `static`**: thuộc về **class**, **chia sẻ chung** cho tất cả. Chỉ có **1 vùng
  nhớ** cho `DatabaseConfig.connection`, dù bạn gọi `DatabaseConfig.getConnection()` từ bao nhiêu nơi.

→ Singleton **lợi dụng `static`** để đảm bảo "chỉ có 1 bản" — đó là lý do field `connection` (và
`instance`, `currentUser` ở các ví dụ dưới) đều là `static`.

### `synchronized` trong `getConnection()` — tạm hiểu sơ ở đây

```java
public static synchronized Connection getConnection() { ... }
```

`synchronized` đảm bảo: nếu 2 thread (luồng) cùng gọi `getConnection()` y lúc — chỉ 1 thread được
chạy vào trong tại một thời điểm, tránh việc cả 2 cùng thấy `connection == null` và **cả 2 đều tạo
kết nối mới** (tạo ra 2 connection — phá vỡ Singleton!). Sẽ giải thích sâu hơn ở `KienThuc_06`.

---

### Singleton #2 — `ProjectService<Task>` (Singleton "Lazy Initialization")

```java
public class ProjectService<T extends Task> implements IProjectAnalytics {

    private static ProjectService<Task> instance;     // (1) static field

    public static ProjectService<Task> getInstance() { // (3) cổng vào duy nhất
        if (instance == null) instance = new ProjectService<>();
        return instance;
    }

    public static void reset() { instance = null; }    // dùng khi logout
    ...
}
```

Lưu ý: ở đây **constructor KHÔNG private** (có thể `new ProjectService<>()` bên trong class) nhưng
*cách dùng đúng* luôn là gọi `getInstance()`. Đây gọi là **"Lazy Initialization"** (khởi tạo "lười"):
object `ProjectService` chỉ được tạo ra **lần đầu tiên ai đó gọi `getInstance()`**, không tạo sẵn
ngay khi app khởi động — tiết kiệm tài nguyên nếu user không bao giờ vào màn hình cần nó (dù trong
app này, Dashboard luôn gọi `getInstance()` nên hầu như luôn được tạo).

#### Tại sao 3 Controller (`DashboardController`, `AddTaskController`, `TaskListController`) đều cần
**cùng 1 instance**?

```
AddTaskController.service = ProjectService.getInstance()   ──┐
TaskListController.service = ProjectService.getInstance()  ──┼──► CÙNG 1 OBJECT (cùng map, cùng list)
DashboardController.service = ProjectService.getInstance() ──┘
```

Nếu **không** Singleton — mỗi Controller tự `new ProjectService<Task>()`:
- User bấm "Them Task" ở `AddTaskController` → task được thêm vào `map`/`list` của **instance A**.
- Chuyển sang `TaskListController` → nó có **instance B** (rỗng hoặc khác) → **không thấy task vừa
  thêm**, hoặc phải gọi `loadFromDB()` lại từ đầu (chậm, lãng phí).

→ Singleton giải quyết: **"một nơi lưu trữ duy nhất, mọi nơi đọc/ghi vào cùng 1 chỗ"**.

#### `reset()` — Vì sao cần?

```java
public static void reset() { instance = null; }
```

Khi user **logout**, `DashboardController.handleLogout()` gọi `ProjectService.reset()`. Nếu không
reset: user A logout, user B login vào — `ProjectService.instance` **vẫn còn giữ dữ liệu cũ** (map,
list của session trước) cho tới khi `loadFromDBAsync()` load lại. Trong khoảng thời gian đó, user B
có thể "thấy ké" dữ liệu cũ (rủi ro bảo mật nhẹ + dữ liệu sai). `reset()` đặt `instance = null` →
lần `getInstance()` tiếp theo sẽ tạo object **hoàn toàn mới, map/list rỗng**.

---

### Singleton #3 — `UserSession` — "Singleton Thuần Static" (Không Có Object Nào Cả!)

```java
public class UserSession {

    private static User currentUser;

    private UserSession() {}

    public static void    set(User user) { currentUser = user; }
    public static User    get()          { return currentUser; }
    public static boolean isLoggedIn()   { return currentUser != null; }
    public static boolean isAdmin() {
        return currentUser != null && "admin".equalsIgnoreCase(currentUser.role);
    }
    public static void clear() { currentUser = null; }
}
```

Đây là biến thể "cực đoan" của Singleton: **không hề có `instance` field, không có object
`UserSession` nào được tạo ra**. Mọi thứ là `static` — class `UserSession` đóng vai trò như một
"hộp lưu trữ toàn cục" (global storage) cho 1 giá trị: `currentUser`.

#### So sánh 3 Singleton

| | `DatabaseConfig` | `ProjectService` | `UserSession` |
|---|---|---|---|
| Có field `instance`? | Có (`connection`) | Có (`instance`) | Không — chỉ có `currentUser` |
| Có tạo object không? | Có — 1 object `Connection` | Có — 1 object `ProjectService<Task>` | **Không object nào** |
| Mục đích | Quản lý **1 kết nối DB** | Quản lý **1 kho dữ liệu task** (có hành vi phức tạp: map, list, lock) | Lưu **1 giá trị trạng thái đăng nhập** |
| Có `reset`/`clear`? | Không (tự reconnect nếu đóng) | `reset()` khi logout | `clear()` khi logout |

#### Tại sao `UserSession` không cần truyền qua constructor?

So sánh 2 cách:

```java
// CÁCH SAI — phải truyền "currentUser" qua MỌI constructor của MỌI controller
public class DashboardController {
    public DashboardController(User currentUser) { ... }   // SceneSwitcher phải biết truyền user!
}
public class TaskListController {
    public TaskListController(User currentUser) { ... }    // lại phải truyền nữa!
}
```

JavaFX **tự tạo Controller** khi load FXML (`FXMLLoader.load()`) — bạn **không tự gọi
`new XxxController()`**, nên **không có cách nào truyền tham số qua constructor**!

```java
// CÁCH ĐÚNG — UserSession (global static) — bất kỳ Controller nào cũng đọc được
public class TaskListController {
    @Override
    public void initialize(...) {
        btnDelete.setVisible(UserSession.isAdmin());   // đọc trực tiếp, không cần ai "đưa" cho nó
    }
}
```

→ Singleton/static state là **cách thực tế duy nhất** để chia sẻ dữ liệu (session, cấu hình, cache)
giữa các Controller được JavaFX tự tạo.

#### ⚠️ Cạm bẫy của Singleton (cần biết để dùng đúng lúc)

Singleton tiện nhưng có 2 rủi ro:
1. **Khó test** — vì state là global, test này có thể ảnh hưởng test khác (nếu không `reset()`).
2. **Ẩn dependency** — đọc code `TaskListController`, bạn không thấy ngay nó phụ thuộc vào
   `ProjectService`/`UserSession` (vì không có trong constructor) — phải đọc kỹ source mới biết.

→ Trong app desktop nhỏ như `ProjectManagerApp`, đánh đổi này **hợp lý**. Trong hệ thống lớn (nhiều
team), người ta thường dùng **Dependency Injection** (Spring, v.v.) để giảm 2 vấn đề trên — nhưng đó
là kiến thức cho bài học khác.

---

## 2. Factory Pattern — "Ẩn Việc `new`, Chỉ Đưa `typeCode`"

### Vấn đề cần giải quyết

Không có Factory, `AddTaskController` sẽ phải viết:

```java
// CÁCH KHÔNG DÙNG FACTORY
Task task;
if (typeCode.equals("B")) {
    task = new Bug();
} else if (typeCode.equals("F")) {
    task = new Feature();
} else {
    throw new IllegalArgumentException("Loai khong hop le");
}
```

Nếu sau này có thêm `Improvement extends Task`, đoạn `if/else` này phải **sửa lại ở MỌI nơi** có
logic tương tự (giả sử có 5 Controller cần tạo Task → sửa 5 chỗ → dễ sót).

### Giải pháp — `TaskFactory`

```java
public class TaskFactory {

    private TaskFactory() {}   // utility class — không khởi tạo (giống PasswordHasher, Validator)

    public static Task create(String typeCode) {
        return switch (typeCode.toUpperCase()) {
            case "B" -> new Bug();
            case "F" -> new Feature();
            default  -> throw new IllegalArgumentException(
                "Loai task khong hop le: \"" + typeCode + "\". Chi chap nhan B hoac F.");
        };
    }
}
```

Bây giờ, `AddTaskController` chỉ cần:

```java
Task task = TaskFactory.create(typeCode);   // không cần biết "new Bug()" hay "new Feature()"
task.id = txtId.getText().trim().toUpperCase();
task.title = txtTitle.getText().trim();
// ...
```

### Lợi ích cụ thể

1. **Tập trung logic tạo object vào 1 nơi** — nếu thêm `Improvement`, chỉ sửa `TaskFactory.create()`
   (thêm `case "I" -> new Improvement();`), **không sửa Controller nào cả**.
2. **`toUpperCase()`** — `create("b")` và `create("B")` đều ra `Bug` — Factory xử lý việc chuẩn hóa
   input, Controller không cần lo.
3. **`default -> throw ...`** — nếu ai gọi `create("X")` (loại không tồn tại), lỗi được phát hiện
   **ngay tại điểm tạo object**, với message rõ ràng — dễ debug hơn so với lỗi xảy ra "đâu đó về
   sau" vì object bị tạo sai loại.

### "Factory chỉ tạo object RỖNG" — phân chia trách nhiệm

Để ý `TaskFactory.create("B")` trả về `Bug` với **mọi field đều `null`/giá trị mặc định** — Factory
**không** điền `id`, `title`... Đó là việc của `AddTaskController` (vì chỉ Controller biết user nhập
gì). → Factory **chỉ chịu trách nhiệm "tạo loại object đúng"**, không chịu trách nhiệm "điền dữ
liệu".

---

## 3. Template Method Pattern — "Khung Cố Định, Chi Tiết Linh Hoạt"

### Vấn đề cần giải quyết

Bạn muốn **mọi loại Task** (Bug, Feature, và tương lai có thể nhiều loại khác) khi in ra console đều
theo **đúng 1 format cố định** — không để từng class tự ý in theo ý mình (dễ gây format lộn xộn,
khó đọc khi in danh sách lẫn Bug/Feature).

### Giải pháp

```java
public abstract class Task implements ITask, IPersistable {

    public abstract int GetEffort();   // "chi tiết" — subclass tự quyết định

    // "khung" — final, KHÔNG class con nào được override / thay đổi format này
    public final void printSummary() {
        System.out.printf("[%-1s] %-8s | %-35s | Pri:%-6s | %-22s | %dh%n",
            getTypeCode(), id, title, priority, GetStatusLabel(), GetEffort());
    }
}
```

`printSummary()`:
- Định nghĩa **format cố định** (`"[%-1s] %-8s | ..."`) — đây là "khung sườn" (template/skeleton)
  của thuật toán "in 1 task ra console".
- Bên trong format đó, nó **gọi các method abstract** (`getTypeCode()`, `GetStatusLabel()`,
  `GetEffort()`) — đây là các "chỗ trống" mà mỗi subclass **tự điền vào theo cách riêng**.
- `final` → **không class con nào** (`Bug`, `Feature`, hay class tương lai) có thể override
  `printSummary()` để thay đổi format → đảm bảo **tính nhất quán** trong toàn app.

### Kết quả khi gọi với Bug và Feature

```
[B] B001     | Login page crash on Safari          | Pri:HIGH   | [BUG] Chua xu ly        | 9h
[F] F001     | Dark mode toggle                    | Pri:LOW    | [FEAT] Chua bat dau     | 8h
```

Cùng 1 method `printSummary()`, cùng 1 format — nhưng nội dung `[BUG]`/`[FEAT]`, effort (9h/8h) khác
nhau vì `GetStatusLabel()` và `GetEffort()` được **mỗi subclass tự định nghĩa**.

### `final` — từ khóa quan trọng cần nhớ ở đây

`final` trên **method**: method này **không thể bị override** bởi subclass (khác với `final` trên
**field** như `LoginRequest.username` — nghĩa là field không thể bị **gán lại giá trị**). Cả hai
cách dùng đều mang ý nghĩa "khóa cứng, không cho thay đổi" — nhưng áp dụng cho 2 thứ khác nhau
(method vs. field/biến).

---

## 4. DAO Pattern (Data Access Object) — "Toàn Bộ SQL Sống Ở Đây, Và Chỉ Ở Đây"

### Vấn đề cần giải quyết

Nếu không có DAO, code SQL sẽ "rải rác" khắp nơi:

```java
// CÁCH SAI — ProjectService viết SQL trực tiếp
public boolean Add(T task) {
    String sql = "INSERT INTO Tasks (...) VALUES (...)";  // SQL nằm trong Service!
    PreparedStatement ps = connection.prepareStatement(sql);
    ...
}
```

Vấn đề: nếu mai đổi cấu trúc bảng `Tasks` (thêm cột), bạn phải **tìm khắp Service, Controller** xem
chỗ nào có SQL liên quan tới `Tasks` để sửa — rất dễ sót.

### Giải pháp — `TaskRepository` / `UserRepository`

```java
public class TaskRepository {

    private final Connection conn = DatabaseConfig.getConnection();

    public boolean insert(Task t) { /* SQL INSERT ở đây */ }
    public List<Task> findAll() { /* SQL SELECT ở đây */ }
    public Task findById(String id) { /* SQL SELECT WHERE ở đây */ }
    public boolean updateStatus(String id, String newStatus) { /* SQL UPDATE ở đây */ }
    public boolean delete(String id) { /* SQL DELETE ở đây */ }
}
```

**Quy tắc:** `ProjectService`, `AuthService`, và mọi Controller **không bao giờ viết `SELECT`,
`INSERT`, `UPDATE`, `DELETE`** trực tiếp — họ chỉ gọi `repo.insert(task)`, `repo.findAll()`, v.v.

### Lợi ích

1. **1 nơi duy nhất biết cấu trúc bảng** — nếu đổi tên cột `EstimatedHours` → `Hours`, chỉ sửa trong
   `TaskRepository` (các dòng `rs.getInt("EstimatedHours")`, `ps.setInt(7, ...)`) — `ProjectService`
   và Controller **không cần biết, không cần sửa**.
2. **Service làm việc với OBJECT (`Task`, `User`), không làm việc với "hàng (row)" SQL thô** —
   `repo.findAll()` trả về `List<Task>` (đã là object Java), không phải `ResultSet`.
3. **Dễ thay DB khác** — nếu đổi từ SQL Server sang PostgreSQL/MySQL, chỉ cần viết lại
   `TaskRepository`/`UserRepository` (đổi cú pháp SQL nếu cần) — `ProjectService`, Controller,
   FXML... **không đổi 1 dòng nào**.

### `mapRow()` — "Cầu Nối" Giữa Dữ Liệu Thô (SQL) Và Object (Java)

```java
private Task mapRow(ResultSet rs) throws SQLException {
    String type = rs.getString("TaskType");   // "B" hoặc "F" — cột discriminator
    if ("B".equals(type)) {
        Bug b = new Bug();
        b.id = rs.getString("TaskId");
        ...
        return b;
    } else {
        Feature f = new Feature();
        ...
        return f;
    }
}
```

Mỗi hàng (row) trong bảng `Tasks` là dữ liệu **thô** (text/số) — `mapRow()` đọc cột `TaskType` (gọi
là **discriminator column** — cột "phân loại") để quyết định: tạo `new Bug()` hay `new Feature()`,
rồi gán từng cột vào field tương ứng. Đây gọi là **Object-Relational Mapping (ORM)** ở mức thủ công
(thư viện như Hibernate/JPA tự động hóa việc này — nhưng hiểu cách làm thủ công giúp bạn hiểu ORM
hoạt động "bên dưới" như thế nào).

---

## 5. Tổng Kết — Bảng So Sánh 4 Pattern

| Pattern | Giải quyết vấn đề gì? | Dấu hiệu nhận biết trong code |
|---|---|---|
| **Singleton** | Đảm bảo chỉ có 1 instance/1 nguồn sự thật (single source of truth) dùng chung toàn app | `private static`, constructor `private` (hoặc toàn `static`), method `getInstance()`/`get()` |
| **Factory** | Ẩn logic `new XXX()`, tập trung tại 1 nơi, dễ mở rộng thêm loại mới | Class có `private` constructor, method `static create(...)` trả về kiểu cha/interface |
| **Template Method** | Khung thuật toán cố định (format, thứ tự bước), chi tiết do subclass quyết định | Method `final` trong class cha, gọi các method `abstract` |
| **DAO** | Tách SQL ra khỏi business logic, tập trung tại 1 nơi theo từng bảng | Class `XxxRepository` với các method `insert/findAll/findById/update/delete` + `mapRow()` |

---

**Tiếp theo:** `ProjectManagerApp_KienThuc_03_Generic_Collection.md` — `ProjectService<T extends
Task>` nghĩa là gì, và tại sao `ProjectService` cần CẢ `HashMap` VÀ `ArrayList` cùng lúc.
