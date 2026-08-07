# ProjectManagerApp — Kiến Thức 05: JDBC & Database (Connection, PreparedStatement, ResultSet)

> File code liên quan: `DatabaseConfig.java`, `TaskRepository.java`, `UserRepository.java`, script
> SQL tạo bảng `Users`/`Tasks` (xem `ProjectManagerApp_Guide_00_Setup.md`,
> `Guide_02_DataLayer.md`)

---

## 1. JDBC Là Gì?

**JDBC (Java Database Connectivity)** là một **API chuẩn** (bộ interface) cho phép code Java
"nói chuyện" với database (SQL Server, MySQL, PostgreSQL...) thông qua **driver** (file `.jar`) của
từng loại DB.

```
Java code (TaskRepository)
      │  dùng API chuẩn: Connection, Statement, ResultSet (java.sql.*)
      ▼
JDBC Driver (mssql-jdbc-12.x.x.jre11.jar)   ← "phiên dịch" giữa Java và SQL Server
      │
      ▼
SQL Server (ProjectManagerDB)
```

Lợi ích: code Java viết bằng `java.sql.Connection`, `PreparedStatement`, `ResultSet` — **những
interface CHUẨN, giống nhau cho mọi loại DB**. Nếu đổi từ SQL Server sang PostgreSQL, bạn chỉ cần đổi
**driver jar** + **connection URL** trong `DatabaseConfig` — phần code dùng `Connection`/
`PreparedStatement`/`ResultSet` trong `TaskRepository` **hầu như không đổi**.

---

## 2. `Connection` — "Đường Dây Điện Thoại" Tới Database

```java
private static final String URL = "jdbc:sqlserver://localhost:1433;databaseName=ProjectManagerDB;encrypt=false";
private static final String USER = "sa";
private static final String PASSWORD = "your_password";

public static synchronized Connection getConnection() {
    try {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(URL, USER, PASSWORD);
        }
    } catch (Exception e) {
        System.out.println("[DB] Loi ket noi: " + e.getMessage());
    }
    return connection;
}
```

### Giải mã connection URL

```
jdbc:sqlserver://localhost:1433;databaseName=ProjectManagerDB;encrypt=false
└┬─┘ └───┬────┘  └───┬───┘ └┬─┘ └─────────────┬──────────────┘ └────┬─────┘
 │      │           │       │                │                     │
 │   loại driver  địa chỉ  cổng        tên database               tắt mã hóa
 │   (SQL Server) máy chủ  (port)      cần kết nối                kết nối (chỉ
JDBC                                                              dùng cho LOCAL/
protocol                                                          dev — KHÔNG dùng
                                                                   `encrypt=false`
                                                                   trên production!)
```

- `localhost:1433` — `localhost` = máy của chính bạn (không phải máy chủ ở xa); `1433` là **cổng
  (port) mặc định của SQL Server**.
- `DriverManager.getConnection(URL, USER, PASSWORD)` — đây là **lệnh thực sự "bấm số gọi điện"** —
  driver dùng URL để biết "gọi đi đâu", USER/PASSWORD để "xác thực ai đang gọi".

### `connection == null || connection.isClosed()` — Tại Sao Kiểm Tra 2 Điều Kiện?

- `connection == null` — **lần đầu tiên** gọi `getConnection()`, chưa từng kết nối → phải tạo mới.
- `connection.isClosed()` — **đã từng kết nối**, nhưng connection đó **đã bị đóng** (ví dụ SQL
  Server tự đóng connection "rảnh" quá lâu — gọi là *connection timeout*) → phải tạo **kết nối mới**.

Nếu chỉ kiểm tra `connection == null`, sau khi connection cũ bị đóng (do timeout), mọi câu lệnh SQL
tiếp theo sẽ ném exception "connection is closed" — app sẽ lỗi liên tục cho tới khi restart. Kiểm tra
cả `isClosed()` giúp **tự phục hồi (self-healing)** — lần gọi tiếp theo sẽ tự tạo connection mới.

---

## 3. `Statement` vs `PreparedStatement` — Vì Sao BẮT BUỘC Dùng `PreparedStatement`?

### Cách KHÔNG AN TOÀN — `Statement` + Nối Chuỗi (String Concatenation)

```java
// ❌ CỰC KỲ NGUY HIỂM — KHÔNG BAO GIỜ làm thế này
String username = txtUsername.getText();   // user nhập: admin' OR '1'='1
String sql = "SELECT * FROM Users WHERE Username = '" + username + "'";
// sql trở thành:
// SELECT * FROM Users WHERE Username = 'admin' OR '1'='1'
//                                                ^^^^^^^^^^^^ luôn ĐÚNG với MỌI hàng!
// → Trả về TẤT CẢ user trong bảng — kẻ tấn công đăng nhập được mà KHÔNG cần biết password!
```

Đây là **SQL Injection** — một trong những lỗ hổng bảo mật **kinh điển và nguy hiểm nhất**. Kẻ tấn
công "tiêm" (inject) code SQL của họ vào trong chuỗi SQL của bạn, thông qua input mà bạn tin tưởng
ghép trực tiếp vào câu lệnh.

### Cách AN TOÀN — `PreparedStatement` + Dấu `?`

```java
public User findByUsername(String username) {
    String sql = "SELECT * FROM Users WHERE Username = ?";
    try (PreparedStatement ps = conn.prepareStatement(sql)) {
        ps.setString(1, username);     // "?" thứ 1 = username
        ResultSet rs = ps.executeQuery();
        if (rs.next()) return mapRow(rs);
    } catch (SQLException e) { e.printStackTrace(); }
    return null;
}
```

### Cách `PreparedStatement` Hoạt Động — 2 Bước Tách Biệt

```
Bước 1 (compile câu lệnh): conn.prepareStatement("SELECT * FROM Users WHERE Username = ?")
   → SQL Server "biên dịch" cấu trúc câu lệnh TRƯỚC, với "?" là 1 CHỖ TRỐNG (placeholder)
   → Cấu trúc câu lệnh được CỐ ĐỊNH — không thể bị thay đổi bởi dữ liệu sau đó

Bước 2 (gán giá trị): ps.setString(1, "admin' OR '1'='1")
   → Giá trị "admin' OR '1'='1" được coi là MỘT CHUỖI DỮ LIỆU DUY NHẤT
   → SQL Server tìm Username CÓ GIÁ TRỊ CHÍNH XÁC là "admin' OR '1'='1" (1 chuỗi 18 ký tự)
   → Không tìm thấy user nào có username kỳ lạ như vậy → trả về RỖNG → login thất bại (đúng như mong đợi!)
```

→ Vì **cấu trúc câu lệnh SQL** (`SELECT ... WHERE Username = ?`) được "đóng băng" **trước khi** dữ
liệu người dùng được đưa vào, **không có cách nào** dữ liệu đó "biến thành" một phần cấu trúc SQL
(như dấu `'` để "thoát" khỏi chuỗi). Đây là lý do `?` + `setXxx(index, value)` **chống được SQL
Injection hoàn toàn** (khi dùng đúng cách — không bao giờ nối chuỗi vào SQL).

### Đánh Số `?` — Bắt Đầu Từ 1, KHÔNG Phải 0!

```java
String sql = "INSERT INTO Tasks (TaskId,Title,Priority,Status,TaskType,Severity,EstimatedHours,AssignedTo) "
           + "VALUES (?,?,?,?,?,?,?,?)";
//              ?1     ?2    ?3       ?4     ?5      ?6       ?7             ?8
ps.setString(1, t.id);        // ? thứ 1 = TaskId
ps.setString(2, t.title);     // ? thứ 2 = Title
ps.setString(3, t.priority);  // ? thứ 3 = Priority
ps.setString(4, t.status);    // ? thứ 4 = Status
ps.setString(5, t.getTypeCode()); // ? thứ 5 = TaskType
```

⚠️ Lỗi rất hay gặp với người mới: **index của `?` bắt đầu từ `1`**, không phải `0` (khác với index
của `Array`/`List` trong Java, luôn bắt đầu từ `0`!). Nếu set sai thứ tự hoặc sai index → dữ liệu bị
lưu vào sai cột, hoặc ném `SQLException` ("index out of range").

---

## 4. `try-with-resources` — Tự Động `close()`, Tránh Resource Leak

```java
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, t.id);
    ...
    ps.executeUpdate();
    return true;
} catch (SQLException e) {
    System.out.println("[REPO] Insert loi: " + e.getMessage());
    return false;
}
// KHÔNG cần viết ps.close() — Java tự động gọi khi ra khỏi block try, DÙ có exception hay không
```

### Tại Sao Phải `close()` `PreparedStatement`?

`PreparedStatement` (và `ResultSet`) chiếm **tài nguyên ở phía SQL Server** (con trỏ, bộ nhớ tạm cho
câu lệnh đã "biên dịch"). Nếu không `close()`, sau hàng trăm/nghìn lần gọi `insert()`/`findAll()`,
tài nguyên này **tích tụ dần** ("resource leak" — rò tài nguyên) — cuối cùng SQL Server từ chối kết
nối mới ("too many open cursors"/connections).

### Cú Pháp `try (... = ...) { }`

Bất kỳ object nào implement interface `AutoCloseable` (`PreparedStatement`, `ResultSet`,
`Connection`, `FileInputStream`,...) đều có thể đặt trong `try (...)`. Java tự động gọi
`.close()` của object đó **ngay khi thoát khỏi block `try`** — kể cả khi thoát **vì exception**.

```java
// Tương đương "thủ công" (KHÔNG nên viết thế này — chỉ để hiểu cơ chế bên dưới):
PreparedStatement ps = conn.prepareStatement(sql);
try {
    ps.setString(1, t.id);
    ps.executeUpdate();
    return true;
} catch (SQLException e) {
    return false;
} finally {
    ps.close();   // try-with-resources làm việc này TỰ ĐỘNG cho bạn
}
```

> Lưu ý: `Connection conn = DatabaseConfig.getConnection()` trong `TaskRepository`/`UserRepository`
> **KHÔNG** đặt trong `try-with-resources` — vì nó là **Singleton** (1 connection dùng suốt đời
> app, xem `KienThuc_02`), không phải tài nguyên "dùng 1 lần rồi đóng" như `PreparedStatement`.

---

## 5. `ResultSet` — Đọc Kết Quả `SELECT` Trả Về

```java
public List<Task> findAll() {
    List<Task> list = new ArrayList<>();
    String sql = "SELECT * FROM Tasks ORDER BY "
               + "CASE Priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, TaskId";
    try (Statement st = conn.createStatement()) {
        ResultSet rs = st.executeQuery(sql);
        while (rs.next()) list.add(mapRow(rs));
    } catch (SQLException e) { e.printStackTrace(); }
    return list;
}
```

### `ResultSet` Giống "Con Trỏ" Di Chuyển Qua Từng Hàng

```
ResultSet ban đầu:   [con trỏ TRƯỚC hàng đầu tiên]
                      hàng 1: B001 | Login crash | HIGH | todo  | B | HIGH | NULL | NULL
                      hàng 2: B002 | Wrong total | MEDIUM | in_progress | B | MEDIUM | NULL | NULL
                      hàng 3: F001 | Dark mode   | LOW  | todo  | F | NULL | 8    | Nguyen Van A

rs.next()  → di chuyển con trỏ tới hàng 1, trả về TRUE (có hàng)
  rs.getString("TaskId") → "B001"
  rs.getString("Title")  → "Login crash"
  ...

rs.next()  → di chuyển con trỏ tới hàng 2, trả về TRUE
  ... đọc hàng 2 ...

rs.next()  → di chuyển con trỏ tới hàng 3, trả về TRUE
  ... đọc hàng 3 ...

rs.next()  → không còn hàng nào → trả về FALSE → while loop dừng
```

### `findById()` — `if (rs.next())` Thay Vì `while`

```java
public Task findById(String id) {
    String sql = "SELECT * FROM Tasks WHERE TaskId = ?";
    try (PreparedStatement ps = conn.prepareStatement(sql)) {
        ps.setString(1, id);
        ResultSet rs = ps.executeQuery();
        if (rs.next()) return mapRow(rs);   // chỉ có TỐI ĐA 1 hàng (vì TaskId là PRIMARY KEY)
    } catch (SQLException e) { e.printStackTrace(); }
    return null;   // không tìm thấy → trả về null
}
```

Vì `TaskId` là **PRIMARY KEY** (mỗi giá trị chỉ xuất hiện đúng 1 lần trong bảng — DB tự đảm bảo điều
này), `WHERE TaskId = ?` **chỉ có thể trả về 0 hoặc 1 hàng** → dùng `if` (kiểm tra 1 lần) thay vì
`while` (lặp nhiều hàng) là đủ và đúng.

### Các Phương Thức `getXxx()` — Đọc Theo Tên Cột Và Kiểu Dữ Liệu

```java
b.id       = rs.getString("TaskId");       // cột VARCHAR  → getString()
f.estimatedHours = rs.getInt("EstimatedHours");  // cột INT → getInt()
u.status   = rs.getBoolean("Status");      // cột BIT (SQL Server) → getBoolean()
u.id       = rs.getInt("UserId");          // cột INT IDENTITY → getInt()
```

Bạn phải gọi **đúng method tương ứng với kiểu dữ liệu của cột trong DB** (`getString` cho
`VARCHAR`/`NVARCHAR`, `getInt` cho `INT`, `getBoolean` cho `BIT`...). Gọi sai kiểu có thể ném
exception hoặc trả về giá trị không mong muốn.

---

## 6. `executeQuery()` vs `executeUpdate()` — Khác Biệt Cốt Lõi

| Method | Dùng cho câu lệnh nào? | Trả về gì? |
|---|---|---|
| `executeQuery()` | `SELECT` — câu lệnh **đọc** dữ liệu | `ResultSet` (tập hợp các hàng kết quả) |
| `executeUpdate()` | `INSERT`, `UPDATE`, `DELETE` — câu lệnh **thay đổi** dữ liệu | `int` — **số hàng bị ảnh hưởng** |

```java
public boolean updateStatus(String id, String newStatus) {
    String sql = "UPDATE Tasks SET Status = ? WHERE TaskId = ?";
    try (PreparedStatement ps = conn.prepareStatement(sql)) {
        ps.setString(1, newStatus);
        ps.setString(2, id);
        return ps.executeUpdate() > 0;   // > 0 = ít nhất 1 row bị ảnh hưởng = update thành công
    } catch (SQLException e) { e.printStackTrace(); return false; }
}
```

`executeUpdate() > 0` là idiom phổ biến để kiểm tra "câu lệnh UPDATE/DELETE có thực sự ảnh hưởng
hàng nào không" — ví dụ nếu `id` không tồn tại trong bảng, `UPDATE ... WHERE TaskId = 'XYZ'` (không
khớp hàng nào) → `executeUpdate()` trả về `0` → `updateStatus()` trả về `false` (dù **không có lỗi
SQL nào xảy ra** — chỉ là "không có gì để update").

---

## 7. `setNull(index, Types.XXX)` — Rõ Ràng "Cột Này Không Áp Dụng"

```java
if (t instanceof Bug) {
    Bug b = (Bug) t;
    ps.setString(6, b.severity);
    ps.setNull(7, Types.INTEGER);   // Bug không có EstimatedHours → set NULL rõ ràng
    ps.setNull(8, Types.NVARCHAR);  // Bug không có AssignedTo → set NULL rõ ràng
} else {
    Feature f = (Feature) t;
    ps.setNull(6, Types.VARCHAR);   // Feature không có Severity → set NULL rõ ràng
    ps.setInt(7, f.estimatedHours);
    if (f.isAssigned()) ps.setString(8, f.getAssignedTo());
    else                ps.setNull(8, Types.NVARCHAR);
}
```

`Types.INTEGER`, `Types.VARCHAR`, `Types.NVARCHAR` là các **hằng số (constant)** trong
`java.sql.Types` — mô tả "kiểu dữ liệu SQL của cột này LÀ GÌ", để driver biết cách gửi giá trị
`NULL` đúng kiểu xuống DB (SQL Server cần biết "NULL của kiểu gì" để khớp với kiểu cột, dù giá trị
là NULL).

→ Đây là phần thực thi của **"Discriminator Pattern"** đã giới thiệu ở `KienThuc_02`: 1 bảng
`Tasks` chứa cả Bug và Feature, các cột "không thuộc về" loại hiện tại được set `NULL` rõ ràng.

---

## 8. Đọc Lại Schema SQL — Các Ràng Buộc (Constraints) Quan Trọng

```sql
CREATE TABLE Users (
    UserId       INT IDENTITY(1,1) PRIMARY KEY,
    Username     VARCHAR(50)  NOT NULL UNIQUE,
    PasswordHash VARCHAR(100) NOT NULL,
    Email        VARCHAR(100),
    Role         VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (Role IN ('admin','user')),
    Status       BIT          NOT NULL DEFAULT 1  -- 1=active, 0=blocked
);

CREATE TABLE Tasks (
    TaskId         VARCHAR(10)   NOT NULL PRIMARY KEY,
    Title          NVARCHAR(200) NOT NULL,
    Priority       VARCHAR(10)   NOT NULL CHECK (Priority IN ('LOW','MEDIUM','HIGH')),
    Status         VARCHAR(20)   NOT NULL CHECK (Status IN ('todo','in_progress','done')),
    TaskType       CHAR(1)       NOT NULL CHECK (TaskType IN ('B','F')),
    Severity       VARCHAR(10)   NULL CHECK (Severity IN ('LOW','MEDIUM','HIGH','CRITICAL') OR Severity IS NULL),
    EstimatedHours INT           NULL CHECK (EstimatedHours > 0 OR EstimatedHours IS NULL),
    AssignedTo     NVARCHAR(100) NULL
);
```

| Ràng buộc | Ý nghĩa | Ai/Cái gì đảm bảo điều này? |
|---|---|---|
| `IDENTITY(1,1)` | DB **tự sinh** giá trị tăng dần (1, 2, 3...) cho `UserId` — Java không cần (và không nên) tự set giá trị này | SQL Server |
| `PRIMARY KEY` | Giá trị **duy nhất** + **không NULL** + dùng để tìm hàng nhanh (có index tự động) | SQL Server — nhưng `ProjectService.map` (HashMap) cũng kiểm tra trùng `id` ở tầng app TRƯỚC khi gọi DB (xem `KienThuc_03`) |
| `NOT NULL` | Cột này **bắt buộc phải có giá trị** | DB từ chối INSERT nếu thiếu |
| `UNIQUE` (Username) | Không 2 user nào có `Username` giống nhau | `AuthService.register()` còn check thêm `userRepo.existsByUsername()` ở tầng app — "double check" |
| `CHECK (Role IN (...))` | Giá trị cột chỉ được là 1 trong các giá trị liệt kê | DB từ chối INSERT/UPDATE nếu giá trị khác |
| `DEFAULT 'user'` | Nếu INSERT không chỉ định `Role`, DB tự điền `'user'` | — |
| `VARCHAR` vs `NVARCHAR` | `VARCHAR` lưu ký tự ASCII (tiếng Anh); `NVARCHAR` lưu **Unicode** (hỗ trợ tiếng Việt có dấu, emoji...) | `Title`, `AssignedTo`, `Email`... dùng `NVARCHAR` vì có thể chứa tiếng Việt |

### "Double Validation" — Vì Sao Validate Cả Ở Java VÀ Ở DB?

Bạn sẽ thấy: `Validator.requireOneOf(priority, "Priority", "LOW", "MEDIUM", "HIGH")` (Java) **và**
`CHECK (Priority IN ('LOW','MEDIUM','HIGH'))` (SQL) — **cùng kiểm tra 1 điều kiện, ở 2 nơi**. Đây
**không phải dư thừa thiếu cân nhắc** — mà là 2 lớp bảo vệ với mục đích khác nhau:

- **Validate ở Java (Validator)**: phản hồi **nhanh, message thân thiện** cho user ngay trên UI,
  **trước khi** tốn round-trip tới DB.
- **`CHECK` constraint ở DB**: lớp bảo vệ **cuối cùng** — đảm bảo dữ liệu **luôn hợp lệ** dù có
  request nào "đi vòng" qua Java validate (ví dụ: 1 app khác, hoặc 1 script SQL chạy thủ công, ghi
  trực tiếp vào DB).

→ Nguyên tắc: **"Đừng tin tưởng dữ liệu chỉ vì nó đã qua 1 lớp kiểm tra"** — đặc biệt với dữ liệu
quan trọng (ràng buộc nghiệp vụ cốt lõi), kiểm tra ở **nhiều lớp** là thực hành tốt.

---

## 9. Tóm Tắt Luồng JDBC Hoàn Chỉnh (INSERT)

```
1. AddTaskController.handleAdd()
2.   → service.Add(task)                          [ProjectService — Service Layer]
3.       → repo.insert(task)                      [TaskRepository — DAO Layer]
4.           a. conn = DatabaseConfig.getConnection()      ← Singleton Connection
5.           b. sql = "INSERT INTO Tasks (...) VALUES (?,?,?,?,?,?,?,?)"
6.           c. try (PreparedStatement ps = conn.prepareStatement(sql)) {
7.                  ps.setString(1, t.id); ps.setString(2, t.title); ...
8.                  if (t instanceof Bug) { ... } else { ... }   ← Discriminator
9.                  ps.executeUpdate();           ← gửi câu lệnh xuống SQL Server
10.                 return true;
11.              } catch (SQLException e) { ... ; return false; }
12.          // ps tự động close() ở đây — try-with-resources
13.       ← trả về true/false cho ProjectService
14.   ← nếu true: cập nhật map + list (in-memory)  [KienThuc_03]
15. ← hiển thị "Da them Bug: B001" lên UI         [KienThuc_07]
```

---

**Tiếp theo:** `ProjectManagerApp_KienThuc_06_Multithreading.md` — vì sao `loadFromDB()` phải chạy
trên `Thread` riêng, `synchronized` bảo vệ dữ liệu như thế nào, và `Platform.runLater` dùng để làm
gì.
