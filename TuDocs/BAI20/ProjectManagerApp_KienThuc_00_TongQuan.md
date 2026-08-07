# ProjectManagerApp — Kiến Thức 00: Tổng Quan & Bản Đồ Kiến Thức

> **Mục đích của series này:** Series `ProjectManagerApp_Guide_00..06` (đã có sẵn trong thư mục `BAI20`)
> hướng dẫn **xây dựng** project. Series `ProjectManagerApp_KienThuc_00..08` (series này) tổng hợp lại
> **toàn bộ kiến thức nền tảng** đứng sau từng dòng code đó — giải thích kỹ như cho người **chưa biết gì**,
> để khi đọc lại code, bạn hiểu được "tại sao code lại viết như vậy", không chỉ "code làm gì".

---

## 1. Vì Sao Phải Học Những Kiến Thức Này?

`ProjectManagerApp` là một app desktop quản lý task (Bug/Feature) có đăng nhập, phân quyền, lưu
database SQL Server. Để hiểu được toàn bộ project, bạn cần nắm vững **8 nhóm kiến thức lớn**:

| # | Nhóm kiến thức                          | Trả lời câu hỏi gì?                                              | File |
|---|------------------------------------------|--------------------------------------------------------------------|------|
| 1 | **OOP cơ bản** (Class, Abstract, Interface, Kế thừa, Đa hình) | Tại sao có `Task`, `Bug`, `Feature`, và 5 interface khác nhau? | `KienThuc_01` |
| 2 | **Design Patterns** (Singleton, Factory, Template Method, DAO) | Tại sao `DatabaseConfig`, `ProjectService` viết theo khuôn mẫu lạ vậy? | `KienThuc_02` |
| 3 | **Generics & Collections** (`<T>`, HashMap, ArrayList, HashSet) | `ProjectService<T extends Task>` nghĩa là gì? Tại sao dùng cả Map và List? | `KienThuc_03` |
| 4 | **Exception Handling** (try/catch/finally, custom exception) | Khi nào ném lỗi, khi nào bắt lỗi, `finally` để làm gì? | `KienThuc_04` |
| 5 | **JDBC & Database** (Connection, PreparedStatement, ResultSet) | Java "nói chuyện" với SQL Server bằng cách nào? Sao phải dùng `?`? | `KienThuc_05` |
| 6 | **Multithreading** (Thread, synchronized, Platform.runLater) | Tại sao load DB phải chạy "nền", không được chạy trên UI thread? | `KienThuc_06` |
| 7 | **JavaFX cơ bản** (FXML, Controller, Scene, TableView, CSS) | `.fxml` và `Controller.java` liên kết với nhau ra sao? | `KienThuc_07` |
| 8 | **Modern Java + Algorithm + Security** (switch expression, two-pointer, SHA-256) | `switch -> {}` là gì? Vì sao không lưu password dạng chữ thường? | `KienThuc_08` |

Đọc theo thứ tự 01 → 08 là hợp lý nhất vì kiến thức sau dựa vào kiến thức trước (ví dụ: phải hiểu
Interface (01) rồi mới hiểu Design Pattern (02); phải hiểu Generic (03) rồi mới hiểu
`ProjectService<T>` dùng trong Multithreading (06), v.v.)

---

## 2. Bản Đồ Kiến Trúc Tổng Thể (Layered Architecture)

Đây là kiến trúc **phân lớp (layered architecture)** — một trong những kiến thức quan trọng nhất,
áp dụng cho hầu hết app thực tế (web, mobile, desktop):

```
┌─────────────────────────────────────────────────────────────────┐
│  UI LAYER (FXML + Controller)             → KienThuc_07          │
│  Người dùng bấm nút, nhập text...                                 │
│  Controller chỉ làm 1 việc: nhận input, gọi Service, hiển thị KQ  │
└───────────────────────────────┬───────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE LAYER (ProjectService, AuthService)  → KienThuc_02, 03   │
│  Chứa LOGIC NGHIỆP VỤ: validate, tính toán, áp dụng business rule │
│  KHÔNG chứa SQL, KHÔNG chứa code UI                               │
└───────────────────────────────┬───────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  REPOSITORY / DAO LAYER (TaskRepository, UserRepository) → 05    │
│  Chứa TOÀN BỘ câu lệnh SQL — Service gọi method, không viết SQL   │
└───────────────────────────────┬───────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE (SQL Server — bảng Users, Tasks)                        │
└─────────────────────────────────────────────────────────────────┘
```

**Quy tắc vàng (Separation of Concerns — Tách biệt trách nhiệm):**
- **Controller** không viết SQL, không tính toán nghiệp vụ phức tạp.
- **Service** không biết gì về JavaFX (`Button`, `Label`...), không viết SQL trực tiếp.
- **Repository** chỉ biết SQL + mapping dữ liệu, không quan tâm ai gọi nó.

→ Lợi ích: nếu mai sau đổi từ SQL Server sang MySQL, chỉ cần sửa Repository. Nếu đổi từ JavaFX sang
web (Spring Boot), chỉ cần viết Controller mới — Service và Repository **giữ nguyên**.

---

## 3. Luồng Dữ Liệu Khi Người Dùng Thêm Một Task (Ví Dụ Xuyên Suốt)

Theo dõi luồng này — nó sẽ xuất hiện lại trong từng file kiến thức với chi tiết khác nhau:

```
1. User mở màn hình "Them Task", chọn loại "Bug", điền form, bấm "Them Task"
   → add_task.fxml gọi onAction="#handleAdd"               (KienThuc_07 — JavaFX)

2. AddTaskController.handleAdd() chạy:
   a. Validator.requireNonBlank(...) kiểm tra input         (KienThuc_04 — Exception)
   b. TaskFactory.create("B") tạo ra object Bug rỗng        (KienThuc_02 — Factory Pattern)
   c. Gán dữ liệu vào object Bug (id, title, severity...)   (KienThuc_01 — OOP / Inheritance)

3. service.Add(task) được gọi — service là ProjectService<Task> (Singleton) (KienThuc_02, 03)
   a. Kiểm tra trùng ID bằng HashMap.containsKey() — O(1)   (KienThuc_03 — Collections)
   b. Gọi repo.insert(task)                                  (KienThuc_05 — JDBC)
      → PreparedStatement chạy câu lệnh INSERT vào SQL Server
   c. finally { in log "Them task ket thuc" }                (KienThuc_04 — finally)

4. Nếu thành công → showMsg("Da them...", true)             (KienThuc_07 — Label màu xanh)
```

---

## 4. Bảng Tra Cứu Nhanh — "Khái Niệm Này Nằm Ở Đâu Trong Code?"

| Khái niệm                          | Xuất hiện ở file code nào                          | Học chi tiết ở |
|--------------------------------------|------------------------------------------------------|----------------|
| `abstract class`                      | `Task.java`                                          | KienThuc_01 |
| `interface` (5 cái)                   | `ITask`, `IPersistable`, `ISeverityRatable`, `IAssignable`, `IProjectAnalytics` | KienThuc_01 |
| Kế thừa (`extends`)                   | `Bug extends Task`, `Feature extends Task`           | KienThuc_01 |
| Đa hình (Polymorphism)                | `List<Task>` chứa cả `Bug` và `Feature`              | KienThuc_01 |
| Template Method Pattern               | `Task.printSummary()` (final)                        | KienThuc_02 |
| Singleton Pattern (3 lần)             | `DatabaseConfig`, `ProjectService`, `UserSession`     | KienThuc_02 |
| Factory Pattern                       | `TaskFactory.create("B"/"F")`                        | KienThuc_02 |
| DAO Pattern                           | `TaskRepository`, `UserRepository`                   | KienThuc_02 |
| Generic `<T extends Task>`            | `ProjectService<T>`                                  | KienThuc_03 |
| `HashMap` + `ArrayList`                | `ProjectService.map`, `ProjectService.list`          | KienThuc_03 |
| `HashSet`                              | `findDuplicateIds()`                                 | KienThuc_03 |
| `try / catch / finally`                | `ProjectService.Add()`                               | KienThuc_04 |
| Custom Exception (`AppException`)     | `PasswordHasher`                                     | KienThuc_04 |
| `PreparedStatement` (chống SQL Injection) | `TaskRepository`, `UserRepository`               | KienThuc_05 |
| `Connection` Singleton                | `DatabaseConfig.getConnection()`                     | KienThuc_05 |
| `Thread` + `Platform.runLater`         | `loadFromDBAsync()`                                  | KienThuc_06 |
| `synchronized`                         | `ProjectService` (lock object)                       | KienThuc_06 |
| FXML + Controller binding              | `login.fxml` ↔ `LoginController`                     | KienThuc_07 |
| `TableView`, `TableColumn`, `CellFactory` | `TaskListController`, `UserListController`        | KienThuc_07 |
| CSS Styling (JavaFX)                   | `main.css`                                            | KienThuc_07 |
| `switch` expression (Java 14+)         | `Bug.GetStatusLabel()`, `Feature.GetStatusLabel()`   | KienThuc_08 |
| Two Pointer Algorithm                  | `ProjectService.reverseOrder()`                      | KienThuc_08 |
| LeetCode #217 (Duplicate)              | `ProjectService.findDuplicateIds()`                  | KienThuc_08 |
| SHA-256 Hashing                        | `PasswordHasher`                                     | KienThuc_08 |

---

## 5. Cách Đọc Series Này Hiệu Quả

1. Đọc xong 1 file kiến thức → mở lại `ProjectManagerApp_Guide_XX_*.md` tương ứng → tìm đúng đoạn
   code được nói tới → đọc lại code với "cặp mắt mới".
2. Đừng học vẹt định nghĩa — luôn tự hỏi: **"Nếu KHÔNG dùng kỹ thuật này, code sẽ tệ ở điểm nào?"**
   Mỗi file đều có mục "Nếu không dùng X thì sao?" để trả lời câu hỏi này.
3. Tất cả ví dụ trong series đều lấy **trực tiếp từ code thật của ProjectManagerApp** — không có ví
   dụ "abc/xyz" trừu tượng.

Bắt đầu với `ProjectManagerApp_KienThuc_01_OOP_KeThua_Interface.md`.
