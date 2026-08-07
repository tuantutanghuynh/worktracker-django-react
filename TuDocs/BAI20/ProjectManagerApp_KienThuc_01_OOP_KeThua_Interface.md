# ProjectManagerApp — Kiến Thức 01: OOP Cơ Bản — Class, Abstract, Interface, Kế Thừa, Đa Hình

> File code liên quan: `ITask.java`, `IPersistable.java`, `ISeverityRatable.java`, `IAssignable.java`,
> `IProjectAnalytics.java`, `Task.java`, `Bug.java`, `Feature.java`, `User.java`, `LoginRequest.java`
> (xem `ProjectManagerApp_Guide_01_CoreModels.md`)

---

## 1. Class và Object — Viên Gạch Đầu Tiên

**Class (lớp)** là một "bản thiết kế" (blueprint). **Object (đối tượng)** là một "sản phẩm" được tạo
ra từ bản thiết kế đó.

Ví dụ: `Bug` là class — nó định nghĩa "một con bug thì có gì: `id`, `title`, `priority`, `severity`...".
Khi bạn viết `new Bug()`, bạn tạo ra **một object cụ thể** từ bản thiết kế `Bug` — giống như từ bản vẽ
nhà, bạn xây ra một căn nhà thật.

```java
Bug b = new Bug();      // tạo OBJECT mới từ CLASS Bug
b.id = "B001";
b.title = "Login page crash on Safari";
b.severity = "HIGH";
```

- `b` là một **biến tham chiếu (reference)** — nó "chỉ tới" object Bug nằm trong vùng nhớ heap.
- Mỗi lần gọi `new Bug()`, Java tạo ra một object **độc lập**, có vùng nhớ riêng.

### Field và Method
- **Field** (thuộc tính / biến instance): dữ liệu mà object lưu giữ. Ví dụ `Task` có field `id`,
  `title`, `priority`, `status`.
- **Method** (phương thức / hành vi): hành động object có thể làm. Ví dụ `Task.printSummary()`,
  `Bug.getSeverityLabel()`.

> **Ghi nhớ:** Field = "object CÓ GÌ", Method = "object LÀM ĐƯỢC GÌ".

---

## 2. Encapsulation (Tính Đóng Gói) — Giấu Dữ Liệu, Lộ Hành Vi

Encapsulation nghĩa là: **dữ liệu nhạy cảm được giấu (private)**, chỉ có thể thay đổi/đọc thông qua
các **method công khai (public)** do class tự định nghĩa.

Nhìn vào `Feature.java`:

```java
public class Feature extends Task implements IAssignable {

    public int    estimatedHours;

    // private: KHÔNG class nào bên ngoài có thể viết feat.assignedTo = "..." trực tiếp
    private String assignedTo = "";

    @Override
    public void assign(String developerName) {
        // Đây là "cổng" duy nhất để THAY ĐỔI assignedTo
        // Có thể validate/xử lý trước khi gán (ví dụ: trim(), chuyển null → "")
        this.assignedTo = (developerName == null) ? "" : developerName.trim();
    }

    @Override
    public String getAssignedTo() { return assignedTo; }   // "cổng" duy nhất để ĐỌC

    @Override
    public boolean isAssigned() { return assignedTo != null && !assignedTo.isBlank(); }
}
```

### Tại sao không khai báo `assignedTo` là `public` luôn cho tiện?

Nếu `assignedTo` là `public`, ai cũng có thể viết:
```java
feature.assignedTo = null;   // BUG! sau đó feature.isAssigned() sẽ NullPointerException
```

Bằng cách bắt buộc đi qua `assign()`, ta đảm bảo **giá trị luôn hợp lệ** (không bao giờ là `null`,
luôn đã `.trim()`). Đây chính là lợi ích cốt lõi của encapsulation: **class tự bảo vệ tính đúng đắn
của dữ liệu của chính nó** — gọi là "bảo toàn invariant" (invariant = điều kiện luôn đúng).

> So sánh: `id`, `title`, `priority`, `status` trong `Task` là `public` (không có getter/setter).
> Đây là cách viết đơn giản hóa cho mục đích học — trong dự án thực tế production, các field này cũng
> nên là `private` với getter/setter hoặc dùng Java Record. Nhưng `assignedTo` thì **buộc phải**
> private vì nó có logic xử lý (`trim()`, chuyển `null`) khi gán.

---

## 3. Abstraction & `abstract class` — "Tao Biết Phải Có Cái Này, Nhưng Không Biết Làm Sao"

**Abstraction (tính trừu tượng)**: định nghĩa "cái gì phải có" mà không cần (hoặc không thể) định
nghĩa "làm như thế nào". `abstract class` là công cụ của Java để biểu diễn điều này.

```java
public abstract class Task implements ITask, IPersistable {

    public String id;
    public String title;
    public String priority;
    public String status;

    // abstract: Task BIẾT rằng mọi task đều có "effort", nhưng KHÔNG BIẾT
    // cách tính cụ thể — vì Bug và Feature tính effort khác nhau hoàn toàn
    public abstract int GetEffort();

    public final void printSummary() {
        System.out.printf("[%-1s] %-8s | %-35s | Pri:%-6s | %-22s | %dh%n",
            getTypeCode(), id, title, priority, GetStatusLabel(), GetEffort());
    }
}
```

### Quy tắc của `abstract class`

1. **Không thể `new Task()`** — bạn không thể tạo object "Task" mơ hồ, chỉ có thể tạo `Bug` hoặc
   `Feature` cụ thể. Thử viết `new Task()` → lỗi compile.
2. **Có thể chứa method abstract** (chưa có code, chỉ có "chữ ký") VÀ method thường (có code đầy đủ,
   ví dụ `printSummary()`).
3. **Class con (`extends Task`) PHẢI implement hết các method abstract**, nếu không sẽ lỗi compile.
   → Đây là cách Java **ép buộc** `Bug` và `Feature` đều phải có `GetEffort()`, dù công thức tính
   khác nhau.

### `GetEffort()` khác nhau ra sao giữa Bug và Feature?

```java
// Trong Bug.java
@Override
public int GetEffort() { return getSeverityScore() * 3; }   // LOW=3h, MEDIUM=6h, HIGH=9h, CRITICAL=12h

// Trong Feature.java
@Override
public int GetEffort() { return estimatedHours; }           // Lấy trực tiếp số giờ user nhập
```

→ Đây chính là sức mạnh của abstraction: code gọi `task.GetEffort()` **không cần biết** `task` là
Bug hay Feature, kết quả luôn đúng theo loại thực tế của nó.

---

## 4. Inheritance (Kế Thừa) — `extends`

`Bug extends Task` nghĩa là: "Bug **LÀ MỘT** Task, cộng thêm vài thứ riêng của Bug".

```
abstract class Task          (id, title, priority, status, GetEffort() abstract, printSummary() final)
        ▲
        │ extends
        │
class Bug implements ISeverityRatable     (thêm: severity, getSeverityLabel(), getSeverityScore())
```

Khi viết `class Bug extends Task`, object `Bug` **tự động có sẵn** mọi field và method `public`/
`protected` của `Task` — không cần viết lại `id`, `title`, `priority`, `status`, hay `printSummary()`.
Bug chỉ cần viết **thêm phần riêng của nó**: field `severity` và 2 method của `ISeverityRatable`.

### "is-a" relationship (quan hệ "là một")

- `Bug` **là một** `Task` → `Bug` **là một** `ITask` → `Bug` **là một** `IPersistable`.
- Vì vậy, một biến kiểu `Task` có thể "chứa" một object `Bug`:

```java
Task t = new Bug();   // HỢP LỆ — vì Bug LÀ MỘT Task
```

Đây chính là nền tảng cho khái niệm tiếp theo: **Polymorphism**.

---

## 5. Polymorphism (Đa Hình) — "Một Lời Gọi, Nhiều Cách Thực Thi"

Đa hình nghĩa là: cùng một dòng code `task.GetStatusLabel()`, nhưng **kết quả thực thi khác nhau**
tùy vào object thật bên trong `task` là `Bug` hay `Feature`.

Nhìn vào `ProjectService<Task>` — nó lưu một `List<T>` (với `T = Task`), chứa **lẫn cả Bug và
Feature**:

```java
List<Task> tasks = service.getAll();   // chứa cả Bug và Feature object

for (Task t : tasks) {
    t.printSummary();   // Java tự biết gọi đúng GetEffort()/GetStatusLabel() của Bug hay Feature
}
```

Khi `printSummary()` (định nghĩa trong `Task`, là `final`) gọi `GetEffort()` và `GetStatusLabel()`,
Java sẽ **tìm version được override trong class thật của object lúc runtime** (gọi là *dynamic
dispatch* / *late binding*) — KHÔNG phải version trong `Task` (vì `Task` không có code cho
`GetEffort()`, nó là `abstract`).

```
t là Bug   → t.GetEffort() chạy code trong Bug.GetEffort()    → severityScore × 3
t là Feature → t.GetEffort() chạy code trong Feature.GetEffort() → estimatedHours
```

### Khi nào cần biết object thật là gì? → `instanceof` + cast

Đôi lúc bạn cần làm việc gì đó **riêng** cho Bug hoặc Feature — ví dụ trong `TaskRepository.insert()`:

```java
if (t instanceof Bug) {
    Bug b = (Bug) t;                 // CAST: ép kiểu từ Task → Bug
    ps.setString(6, b.severity);     // chỉ Bug mới có severity
    ...
} else {
    Feature f = (Feature) t;         // CAST: ép kiểu từ Task → Feature
    ps.setInt(7, f.estimatedHours);  // chỉ Feature mới có estimatedHours
    ...
}
```

- `instanceof` kiểm tra "object này thực chất LÀ class gì lúc runtime?"
- `(Bug) t` là **downcast** — "ép" biến kiểu `Task` thành kiểu `Bug` cụ thể hơn, để truy cập field
  `severity` (field này không tồn tại trong `Task`, chỉ có trong `Bug`).
- Nếu cast sai loại (ví dụ `t` thực ra là `Feature` mà bạn viết `(Bug) t`) → Java ném
  `ClassCastException` lúc runtime.

> **Mẹo nhớ:** `instanceof` + cast giống như việc bạn có một "hộp đồ chơi chung" (`Task`), nhưng để
> chơi xếp hình bạn cần "mở hộp ra và kiểm tra: đây có đúng là bộ Lego không?" trước khi lấy ra dùng
> tính năng riêng của Lego.

---

## 6. Interface — "Hợp Đồng" (Contract)

`interface` định nghĩa **một bộ hành vi (method) mà class implement PHẢI có**, nhưng (thường)
**không chứa field dữ liệu, không chứa code thực thi**.

```java
public interface ITask {
    String GetStatusLabel();   // chỉ có "chữ ký" — không có code, không có {}
}
```

Bất kỳ class nào viết `implements ITask` thì **bắt buộc** phải viết code cho `GetStatusLabel()`,
nếu không sẽ lỗi compile.

### `interface` khác `abstract class` ở điểm nào?

| | `abstract class` | `interface` |
|---|---|---|
| Kế thừa | 1 class chỉ `extends` được **1** abstract class | 1 class có thể `implements` **nhiều** interface |
| Field | Có thể có field thường (`public String id`) | Chỉ có constant (`static final`), hiếm dùng |
| Method có code | Có thể có (`printSummary()` có code, là `final`) | Trước Java 8 thì không; nay có thể có `default` method (project này không dùng) |
| Mục đích | "Là một" (is-a) — chia sẻ code chung | "Có khả năng" (can-do) — mô tả hành vi |

`Task` dùng **cả hai**: `abstract class Task implements ITask, IPersistable` — Task **là một** Task
(dùng abstract class để chia sẻ field `id/title/...` và method `printSummary()`), đồng thời
**có khả năng** `GetStatusLabel()` (ITask) và `getTypeCode()` (IPersistable).

---

## 7. Tại Sao Có 5 Interface Riêng Biệt? (Interface Segregation Principle)

Đây là điểm thiết kế **quan trọng nhất** của bài học này. Nhìn lại bảng 5 interface:

| Interface            | Ai implement?        | Vì sao tách riêng?                                  |
|-----------------------|------------------------|--------------------------------------------------------|
| `ITask`               | `Task` (→ Bug, Feature) | Hành vi CHUNG cho mọi loại task                        |
| `IPersistable`        | `Task` (→ Bug, Feature) | Hành vi CHUNG: cần discriminator để lưu DB             |
| `ISeverityRatable`    | **chỉ `Bug`**           | Chỉ Bug có "mức độ nghiêm trọng"                       |
| `IAssignable`         | **chỉ `Feature`**       | Chỉ Feature có thể "giao cho developer"                |
| `IProjectAnalytics`   | `ProjectService<T>`    | Hành vi thống kê — không liên quan gì đến Task/Bug/Feature |

### Nếu KHÔNG tách interface — gộp tất cả vào `ITask` thì sao?

```java
// CÁCH SAI — "Fat Interface" (interface phình to)
public interface ITask {
    String GetStatusLabel();
    String getSeverityLabel();   // Feature không cần — nhưng BUỘC phải implement!
    int    getSeverityScore();   // Feature không cần
    void   assign(String dev);   // Bug không cần — nhưng BUỘC phải implement!
    String getAssignedTo();      // Bug không cần
    boolean isAssigned();        // Bug không cần
}
```

Khi đó, `Feature` buộc phải viết các method `getSeverityLabel()`, `getSeverityScore()` dù **không hề
có khái niệm severity** — bạn sẽ phải trả về giá trị "rác" như `return "";` hoặc `return 0;`, hoặc
ném `UnsupportedOperationException`. Đây gọi là **"fat interface"** (interface béo) — một
**code smell** (dấu hiệu thiết kế tồi) rất phổ biến.

→ **Interface Segregation Principle (ISP)** — một trong 5 nguyên tắc SOLID — nói rằng:
> *"Không một class nào nên bị buộc phải implement các method mà nó không dùng."*

Bằng cách tách `ISeverityRatable` (chỉ Bug) và `IAssignable` (chỉ Feature) ra riêng:
- `Bug implements Task, ISeverityRatable` → chỉ cần lo về severity.
- `Feature implements Task, IAssignable` → chỉ cần lo về assign developer.
- Không bên nào phải viết code "rác" cho method không liên quan.

### `IProjectAnalytics` — tách interface theo "vai diễn" (role), không theo "loại object"

`IProjectAnalytics` (`countByPriority()`, `countByStatus()`, `showSummary()`) được implement bởi
`ProjectService<T>` — **không phải bởi Task/Bug/Feature**. Đây là minh chứng: interface không nhất
thiết gắn với một "loại đồ vật" — nó có thể đại diện cho **một vai trò/khả năng** ("khả năng thống kê
dự án"), bất kể class nào "đóng vai" đó.

---

## 8. So Sánh Trực Quan: Bug vs Feature

```
                   Bug                            Feature
──────────────────────────────────────────────────────────────────
extends            Task                            Task
implements         ISeverityRatable                IAssignable
getTypeCode()      "B"                              "F"
field riêng        severity (String)                estimatedHours (int), assignedTo (private String)
GetEffort()        severityScore() × 3              estimatedHours (trực tiếp)
GetStatusLabel()   "[BUG] ..." (switch theo status)  "[FEAT] ..." (switch theo status)
```

Cả hai đều **được Task ép buộc** phải có `GetEffort()` và `GetStatusLabel()` (qua `abstract`/
`interface`), nhưng **mỗi class tự quyết định công thức/nội dung riêng** → đây chính là
Abstraction + Polymorphism kết hợp.

---

## 9. `User` và `LoginRequest` — Vì Sao KHÔNG implements ITask?

```java
// User.java — package models.entity
public class User {
    public int     id;
    public String  username;
    public String  passwordHash;
    public String  email;
    public String  role;
    public boolean status;
}
```

`User` **không liên quan gì** đến "Task" — nó thuộc một **domain (lĩnh vực) khác**: domain
**Authentication/Authorization** (đăng nhập, phân quyền), còn `Task/Bug/Feature` thuộc domain
**Project Management**. Hai domain này không nên "dùng chung" interface chỉ vì cả hai đều là
"object có id". Đây là một bài học thiết kế: **đừng kế thừa/implements chỉ vì "giống nhau về mặt kỹ
thuật"** (cả hai đều có `id: int/String`) — phải xét **về mặt ý nghĩa nghiệp vụ** có liên quan
không.

### `LoginRequest` — DTO (Data Transfer Object)

```java
public class LoginRequest {
    public final String username;   // final = không đổi được sau khi tạo
    public final String password;

    public LoginRequest(String username, String password) {
        this.username = username;
        this.password = password;
    }
}
```

- **DTO** = một class "rỗng tuếch", chỉ để **gói (đóng bao) dữ liệu** truyền giữa các layer (ở đây:
  từ `LoginController` → `AuthService`).
- `final` trên field nghĩa là: sau khi `new LoginRequest(...)`, **không ai có thể đổi**
  `req.username = "khac"` được nữa → object **immutable** (bất biến). Điều này giúp tránh lỗi "ai đó
  vô tình sửa request giữa đường truyền dữ liệu".
- Tại sao không dùng luôn `User` để truyền username/password? Vì `User` là **entity DB** (có
  `passwordHash`, `role`, `status`...) — login request chỉ có 2 field (username + password thô,
  chưa hash). Tách riêng giúp rõ ràng: "đây là dữ liệu NGƯỜI DÙNG NHẬP", khác với "đây là dữ liệu
  TRONG DATABASE".

---

## 10. Tóm Tắt — "Nếu Không Dùng OOP Như Thế Này Thì Sao?"

Giả sử không có `abstract class Task` + interfaces, bạn có thể viết:

```java
// CÁCH SAI — 1 class "Task" cho tất cả, dùng field "type" để phân biệt
public class Task {
    String id, title, priority, status, type;  // type = "BUG" hoặc "FEATURE"
    String severity;        // chỉ dùng nếu type == "BUG"
    int estimatedHours;     // chỉ dùng nếu type == "FEATURE"
    String assignedTo;      // chỉ dùng nếu type == "FEATURE"

    int getEffort() {
        if (type.equals("BUG")) { ... tính theo severity ... }
        else { return estimatedHours; }
    }
}
```

**Vấn đề của cách này:**
1. Mọi object Bug đều "mang theo" 2 field rác (`estimatedHours`, `assignedTo`) không dùng đến —
   tốn bộ nhớ, dễ nhầm.
2. Mỗi khi thêm loại task mới (ví dụ "Improvement"), bạn phải sửa `if/else` trong **mọi method**
   (`getEffort()`, `getStatusLabel()`, ...) — nguy cơ quên 1 chỗ rất cao.
3. Không có gì **ép buộc** (compile-time) bạn phải xử lý đủ các case.

**Với OOP (abstract class + interface):**
1. Mỗi class chỉ chứa field nó cần (`Bug` không có `estimatedHours`).
2. Thêm loại task mới → tạo class mới `extends Task implements ...` → compiler **báo lỗi ngay** nếu
   quên implement method abstract nào.
3. Code dùng `task.GetEffort()` không cần sửa gì cả, dù có thêm bao nhiêu loại Task mới.

→ Đây là lý do OOP (đặc biệt là abstraction + polymorphism) là nền tảng của các hệ thống
**dễ mở rộng (extensible)**.

---

**Tiếp theo:** `ProjectManagerApp_KienThuc_02_DesignPatterns.md` — vì sao `DatabaseConfig`,
`ProjectService`, `TaskFactory`... được viết theo những "khuôn mẫu" (pattern) đặc biệt.
