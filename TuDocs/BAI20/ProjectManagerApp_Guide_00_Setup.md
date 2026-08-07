# ProjectManagerApp — Hướng Dẫn 00: Tổng Quan & Setup

**Stack:** Java 11 · JavaFX 17 · SQL Server Express · JDBC · Apache ANT (NetBeans)

---

## Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ProjectManagerApp                               │
│                                                                         │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │  FXML Views  │──▶│   Controllers    │──▶│       Services         │  │
│  │  login       │   │  LoginCtrl       │   │  ProjectService<T>     │  │
│  │  register    │   │  RegisterCtrl    │   │  (Generic+HashMap)     │  │
│  │  dashboard   │   │  DashboardCtrl   │   │  AuthService           │  │
│  │  add_task    │   │  AddTaskCtrl     │   └──────────┬─────────────┘  │
│  │  task_list   │   │  TaskListCtrl    │              │                │
│  │  user_list   │   │  UserListCtrl    │   ┌──────────▼─────────────┐  │
│  └──────────────┘   └──────────────────┘   │     Repositories       │  │
│                                            │  TaskRepository        │  │
│  ┌────────────────┐                        │  UserRepository        │  │
│  │  Models        │                        └──────────┬─────────────┘  │
│  │  ITask (if.1)  │                        ┌──────────▼─────────────┐  │
│  │  IPersist(if.2)│                        │  DatabaseConfig        │  │
│  │  ISeverity(3)  │                        │  (Singleton Pattern)   │  │
│  │  IAssign (4)   │                        └──────────┬─────────────┘  │
│  │  IAnalytics(5) │                                   │                │
│  │  Task (abs.)   │                       SQL Server — ProjectManagerDB │
│  │  Bug / Feature │                       (Tasks + Users tables)        │
│  │  User          │                                                     │
│  └────────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Cấu Trúc Thư Mục Project

```
ProjectManagerApp/
├── src/
│   └── com/
│       └── projectmanager/
│           ├── App.java                          ← Entry point JavaFX
│           ├── config/
│           │   └── DatabaseConfig.java           ← Singleton Pattern
│           ├── exceptions/
│           │   └── AppException.java             ← Custom unchecked exception
│           ├── models/
│           │   ├── ITask.java                    ← Interface 1: hành vi cơ bản
│           │   ├── IPersistable.java             ← Interface 2: lưu xuống DB
│           │   ├── ISeverityRatable.java         ← Interface 3: chỉ Bug
│           │   ├── IAssignable.java              ← Interface 4: chỉ Feature
│           │   ├── IProjectAnalytics.java        ← Interface 5: thống kê dự án
│           │   ├── Task.java                     ← Abstract base (Template Method)
│           │   ├── Bug.java                      ← extends Task + ISeverityRatable
│           │   ├── Feature.java                  ← extends Task + IAssignable
│           │   ├── entity/
│           │   │   └── User.java                 ← Entity ánh xạ bảng Users
│           │   └── dto/
│           │       └── LoginRequest.java         ← DTO đầu vào login
│           ├── factory/
│           │   └── TaskFactory.java              ← Factory Pattern
│           ├── repository/
│           │   ├── TaskRepository.java           ← CRUD bảng Tasks
│           │   └── UserRepository.java           ← CRUD bảng Users
│           ├── service/
│           │   ├── ProjectService.java           ← Generic<T>+HashMap+Singleton
│           │   └── AuthService.java              ← Login / Register
│           ├── session/
│           │   └── UserSession.java              ← Singleton session state
│           ├── utils/
│           │   ├── PasswordHasher.java           ← SHA-256
│           │   └── Validator.java                ← Input validation
│           └── ui/
│               ├── SceneSwitcher.java            ← Chuyển màn hình
│               ├── controllers/
│               │   ├── LoginController.java
│               │   ├── RegisterController.java
│               │   ├── DashboardController.java
│               │   ├── AddTaskController.java
│               │   ├── TaskListController.java
│               │   └── UserListController.java   ← Chỉ admin truy cập được
│               ├── styles/
│               │   └── main.css                  ← Dark theme (Catppuccin Mocha)
│               └── views/
│                   ├── login.fxml
│                   ├── register.fxml
│                   ├── dashboard.fxml
│                   ├── add_task.fxml
│                   ├── task_list.fxml
│                   └── user_list.fxml            ← Chỉ admin thấy
├── lib/
│   ├── mssql-jdbc-12.x.x.jre11.jar
│   └── javafx-sdk/
│       └── lib/                                  ← JavaFX SDK jars
├── build/
├── nbproject/
└── build.xml
```

---

## Phân Quyền (Role-Based Authorization)

| Tính năng              | `user`  | `admin` |
| ---------------------- | :-----: | :-----: |
| Đăng nhập / Đăng ký    | ✓       | ✓       |
| Xem danh sách task     | ✓       | ✓       |
| Thêm task (Bug/Feature)| ✓       | ✓       |
| Cập nhật status task   | ✓       | ✓       |
| **Xóa task**           | ✗       | ✓       |
| **Quản lý users**      | ✗       | ✓       |
| **Block/unblock user** | ✗       | ✓       |

---

## Tóm Tắt Design Patterns

| Pattern             | File                     | Mô tả                                                        |
| ------------------- | ------------------------ | ------------------------------------------------------------ |
| **Singleton**       | `DatabaseConfig`         | 1 Connection duy nhất toàn app                               |
| **Singleton**       | `ProjectService`         | Cùng instance dùng chung giữa tất cả Controllers             |
| **Singleton**       | `UserSession`            | Trạng thái đăng nhập không cần truyền qua constructor        |
| **Factory**         | `TaskFactory`            | Ẩn `new Bug()` / `new Feature()` — caller chỉ dùng type code |
| **Template Method** | `Task.printSummary()`    | Format cố định, nội dung do subclass cung cấp                |

---

## Tóm Tắt Interfaces

| Interface            | Implement bởi           | Mục đích                                 |
| -------------------- | ----------------------- | ---------------------------------------- |
| `ITask`              | `Task` (abstract)       | Hành vi cơ bản: GetStatusLabel, ...      |
| `IPersistable`       | `Task` (abstract)       | `getTypeCode()` cho DB discriminator     |
| `ISeverityRatable`   | `Bug`                   | Mức độ nghiêm trọng của bug              |
| `IAssignable`        | `Feature`               | Gán developer cho feature                |
| `IProjectAnalytics`  | `ProjectService<T>`     | Thống kê, tổng kết dự án                 |

---

## Bước 1 — Tạo Project NetBeans

1. **File → New Project → Java with ANT → Java Application**
2. Đặt tên: `ProjectManagerApp`
3. Tick **"Create Main Class"** → `com.projectmanager.App`

---

## Bước 2 — Thêm Thư Viện

### A. JDBC Driver (SQL Server)
1. Download `mssql-jdbc-12.x.x.jre11.jar` từ Microsoft
2. Tạo thư mục `lib/`, copy jar vào
3. **NetBeans:** Chuột phải **Libraries → Add JAR/Folder**

### B. JavaFX SDK
1. Download JavaFX SDK 17 từ gluonhq.com
2. Giải nén vào `lib/javafx-sdk/`
3. **NetBeans:** Chuột phải **Libraries → Add JAR/Folder** → chọn tất cả jar trong `lib/javafx-sdk/lib/`

### C. VM Options cho JavaFX
**NetBeans:** Chuột phải project → **Properties → Run → VM Options:**
```
--module-path "lib/javafx-sdk/lib" --add-modules javafx.controls,javafx.fxml
```

---

## Bước 3 — Tạo Database

Chạy script sau trong **SQL Server Management Studio (SSMS)**:

```sql
CREATE DATABASE ProjectManagerDB;
GO

USE ProjectManagerDB;
GO

-- Bảng tài khoản người dùng
CREATE TABLE Users (
    UserId       INT IDENTITY(1,1) PRIMARY KEY,
    Username     VARCHAR(50)  NOT NULL UNIQUE,
    PasswordHash VARCHAR(100) NOT NULL,
    Email        VARCHAR(100),
    Role         VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (Role IN ('admin','user')),
    Status       BIT          NOT NULL DEFAULT 1  -- 1=active, 0=blocked
);
GO

-- Bảng task: chứa cả Bug và Feature (discriminator column TaskType)
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
GO

-- Tài khoản admin mặc định (password: admin123)
-- SHA-256("admin123") = jGl25bVBBBW96Qi9Te4V37Fnqchz/Eu4qB9vKrRIqRg=
INSERT INTO Users(Username,PasswordHash,Email,Role,Status)
VALUES ('admin','jGl25bVBBBW96Qi9Te4V37Fnqchz/Eu4qB9vKrRIqRg=','admin@project.com','admin',1);
GO

-- Tài khoản user mẫu (password: user123)
-- SHA-256("user123") = pmWkWSBCL51Bfkhn79xPuKBKHz//H6B+mY6G9/eieuM=
INSERT INTO Users(Username,PasswordHash,Email,Role,Status)
VALUES ('dev01','pmWkWSBCL51Bfkhn79xPuKBKHz//H6B+mY6G9/eieuM=','dev01@project.com','user',1);
GO

-- Dữ liệu task mẫu
INSERT INTO Tasks VALUES ('B001',N'Login page crash on Safari',   'HIGH',  'todo',        'B','HIGH',    NULL, NULL);
INSERT INTO Tasks VALUES ('B002',N'Wrong total in cart',          'MEDIUM','in_progress',  'B','MEDIUM',  NULL, NULL);
INSERT INTO Tasks VALUES ('F001',N'Dark mode toggle',             'LOW',   'todo',         'F', NULL, 8,   N'Nguyen Van A');
INSERT INTO Tasks VALUES ('F002',N'Export to CSV feature',        'HIGH',  'in_progress',  'F', NULL, 20,  N'Tran Thi B');
INSERT INTO Tasks VALUES ('B003',N'Memory leak in background job','HIGH',  'done',         'B','CRITICAL', NULL, NULL);
GO

SELECT * FROM Users;
SELECT * FROM Tasks;
GO
```

---

## Bước 4 — Cấu Hình Kết Nối DB

Mở `DatabaseConfig.java` và chỉnh:

```java
private static final String URL      = "jdbc:sqlserver://localhost:1433;databaseName=ProjectManagerDB;encrypt=false";
private static final String USER     = "sa";
private static final String PASSWORD = "YOUR_ACTUAL_PASSWORD";

// Windows Authentication (không cần username/password):
// private static final String URL = "jdbc:sqlserver://localhost:1433;databaseName=ProjectManagerDB;integratedSecurity=true;encrypt=false";
```

---

## Luồng Chạy Ứng Dụng

```
App.start()
    └─ load login.fxml
           ↓ nhập username + password
    LoginController.handleLogin()
           ↓
    AuthService.login(LoginRequest)
           ↓
    UserRepository.findByUsername() → PasswordHasher.verify()
           ↓ thành công
    UserSession.set(user)
           ↓
    SceneSwitcher → dashboard.fxml
           ↓
    DashboardController.initialize()
        └─ ProjectService.getInstance().loadFromDBAsync()   ← background thread
    ─────────────────────────────────────────────────────
    [Sidebar] Add Task   → add_task.fxml    (user + admin)
    [Sidebar] Task List  → task_list.fxml   (user + admin)
    [Sidebar] Manage Users → user_list.fxml  (admin ONLY)
    [Header]  Logout     → login.fxml
```

---

## Điểm Học Theo File

| Concept                              | File                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| 5 Interfaces khác nhau               | `ITask`, `IPersistable`, `ISeverityRatable`, `IAssignable`, `IProjectAnalytics` |
| Template Method Pattern              | `Task.printSummary()` — final, gọi abstract methods        |
| Singleton (3 nơi)                    | `DatabaseConfig`, `ProjectService`, `UserSession`           |
| Factory Pattern                      | `TaskFactory.create("B"/"F")`                               |
| Generic `<T extends Task>`           | `ProjectService<T>` — Singleton instance là `ProjectService<Task>` |
| Map + List kết hợp                   | HashMap O(1) lookup + ArrayList giữ thứ tự                  |
| Background Thread + Platform.runLater| `loadFromDBAsync` không block JavaFX UI thread              |
| Role-based Authorization             | `UserSession.isAdmin()` — kiểm tra trong mọi Controller     |
| SHA-256 Password Hashing             | `PasswordHasher` — hash khi register, verify khi login      |
| Switch Expression (Java 14+)         | `GetStatusLabel()` trong Bug và Feature                     |
| `finally` block                      | `ProjectService.Add()` — log luôn chạy dù có lỗi hay không  |
| Discriminator Column                 | `TaskType` ('B'/'F') trong DB — `mapRow()` tái tạo đúng class |
| DAO Pattern                          | `TaskRepository`, `UserRepository` — SQL tập trung tại đây  |
