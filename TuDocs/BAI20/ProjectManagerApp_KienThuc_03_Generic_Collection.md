# ProjectManagerApp — Kiến Thức 03: Generics & Collections (HashMap, ArrayList, HashSet)

> File code liên quan: `ProjectService.java` (xem `ProjectManagerApp_Guide_03_Service.md`)

---

## 1. Generic Là Gì? — "Class Có Thể Dùng Với Nhiều Loại Dữ Liệu"

### Vấn đề: Trước khi có Generic

Giả sử bạn muốn viết một "cái hộp" (`Box`) chứa 1 object:

```java
// Không có Generic — phải dùng Object (kiểu cha của MỌI kiểu trong Java)
public class Box {
    private Object content;
    public void set(Object o) { content = o; }
    public Object get() { return content; }
}

Box box = new Box();
box.set("hello");          // OK, set String
String s = (String) box.get();   // PHẢI CAST — và nếu box chứa Integer, cast này lỗi RUNTIME!
```

Vấn đề: **mất type safety** (an toàn kiểu) — compiler không biết `box` chứa gì, lỗi sai kiểu chỉ phát
hiện được lúc **chạy** (runtime), không phát hiện lúc **viết code** (compile time).

### Giải pháp: Generic — `<T>`

```java
public class Box<T> {
    private T content;
    public void set(T o) { content = o; }
    public T get() { return content; }
}

Box<String> box = new Box<>();
box.set("hello");      // OK
String s = box.get();  // KHÔNG CẦN CAST — compiler biết chắc box.get() trả về String
box.set(123);          // LỖI COMPILE ngay — không cần chạy thử mới biết sai
```

`<T>` là **"placeholder kiểu"** (type parameter) — khi bạn viết `Box<String>`, mọi chỗ `T` trong
class `Box` được "thay" bằng `String`. Khi viết `Box<Integer>`, `T` được thay bằng `Integer`. **Cùng
1 đoạn code `Box<T>`**, dùng được cho **vô số kiểu dữ liệu khác nhau**, mà vẫn an toàn kiểu.

> **Quy ước đặt tên:** `T` (Type), `E` (Element — dùng trong List), `K`/`V` (Key/Value — dùng trong
> Map) là các tên 1-chữ thông dụng cho type parameter. Đây chỉ là **quy ước đặt tên**, không phải cú
> pháp bắt buộc — bạn có thể viết `<TaiSan>` cũng được, nhưng không ai làm vậy.

---

## 2. `ProjectService<T extends Task>` — Giải Mã Từng Phần

```java
public class ProjectService<T extends Task> implements IProjectAnalytics {
    private final Map<String, T>  map  = new HashMap<>();
    private final List<T>         list = new ArrayList<>();
    ...
    public boolean Add(T task) { ... }
    public T findById(String id) { ... }
    public List<T> getAll() { ... }
}
```

### `<T extends Task>` — Generic CÓ GIỚI HẠN (Bounded Type Parameter)

- `<T>` (không giới hạn): `T` có thể là **bất kỳ kiểu gì** — `String`, `Integer`, `Bug`,... Bên trong
  class, bạn **chỉ dùng được** các method có trên **mọi object** (`Object`) — như `toString()`,
  `equals()`. Bạn **không thể** gọi `t.GetEffort()` vì compiler không biết `T` có method đó.
- `<T extends Task>`: `T` phải là `Task` **hoặc một class con của `Task`** (`Bug`, `Feature`, hoặc
  loại Task tương lai). → Bên trong `ProjectService`, compiler **cho phép** gọi `t.GetEffort()`,
  `t.id`, `t.getTypeCode()`... vì **bất kỳ kiểu nào thỏa `T extends Task` đều chắc chắn có các
  field/method này** (đã được định nghĩa/ép buộc trong `abstract class Task implements ITask,
  IPersistable`).

> Lưu ý: `extends` ở đây dùng cho cả 2 trường hợp — "T là subclass của Task" **hoặc** "T implement
> interface Task" (Java dùng `extends` cho bounded type dù bound là class hay interface — khác với
> khai báo class thường, nơi `extends` ≠ `implements`).

### Vì Sao Cần "Bound" (`extends Task`) Mà Không Để `<T>` Trống?

Nếu để `<T>` trống:

```java
public class ProjectService<T> {
    public boolean Add(T task) {
        if (map.containsKey(task.id)) ...   // LỖI COMPILE! T không chắc có field "id"
    }
}
```

→ `T` không có giới hạn = compiler chỉ biết `T` là `Object` = không có field `id`, không có method
`GetEffort()`. Bound `extends Task` chính là cách "hứa với compiler": *"dù T là gì, nó LUÔN có những
gì Task có"*.

### Singleton Instance Dùng `ProjectService<Task>` (Upper Bound) — Tại Sao?

```java
private static ProjectService<Task> instance;

public static ProjectService<Task> getInstance() {
    if (instance == null) instance = new ProjectService<>();
    return instance;
}
```

- `instance` có kiểu `ProjectService<Task>` — nghĩa là `T = Task` (kiểu **cha nhất** trong cây kế
  thừa Bug/Feature).
- Vì `Bug extends Task` và `Feature extends Task` → cả `Bug` và `Feature` đều **"là một" `Task`**
  (xem `KienThuc_01` — quan hệ is-a) → `service.Add(bug)` và `service.Add(feature)` **đều hợp lệ**,
  vì tham số `T task` của `Add()` chấp nhận bất cứ gì là `Task` (hoặc con của `Task`).

```java
ProjectService<Task> service = ProjectService.getInstance();
service.Add(new Bug());       // Bug "là một" Task → OK
service.Add(new Feature());   // Feature "là một" Task → OK

List<Task> all = service.getAll();   // List chứa LẪN cả Bug và Feature — đây là Polymorphism (KienThuc_01)
```

### Generic Cho Phép Mở Rộng Trong Tương Lai

Vì class được viết là `ProjectService<T extends Task>` (generic, không hard-code là
`ProjectService` chỉ-cho-`Task`), **về lý thuyết** bạn có thể tạo:

```java
ProjectService<Bug> bugOnlyService = new ProjectService<>();   // T = Bug — chỉ chứa Bug, type-safe
bugOnlyService.Add(new Bug());        // OK
bugOnlyService.Add(new Feature());    // LỖI COMPILE — Feature không phải Bug!
```

Trong app hiện tại chỉ dùng `ProjectService<Task>` (Singleton, chứa cả Bug+Feature), nhưng việc viết
class bằng generic **chuẩn bị sẵn** cho khả năng mở rộng này mà không cần viết lại code.

---

## 3. Cấu Trúc Dữ Liệu Kép: `HashMap` + `ArrayList` — "Tại Sao Cần Cả 2?"

```java
private final Map<String, T>  map  = new HashMap<>();   // Key = task.id, Value = task object
private final List<T>         list = new ArrayList<>(); // giữ thứ tự
```

Đây là điểm thiết kế **rất hay gặp trong thực tế** — hiểu kỹ phần này sẽ giúp bạn ở nhiều bài toán
khác.

### `HashMap<String, T>` — Tra Cứu Nhanh Theo Khóa (Key)

`HashMap` lưu dữ liệu theo cặp **Key → Value**. Bên trong, nó dùng một cơ chế gọi là **hashing**: từ
`Key` (ở đây là `task.id`, ví dụ `"B001"`), nó tính ra một "địa chỉ" trong bộ nhớ và lưu/tìm trực
tiếp tại đó.

```java
public T findById(String id) {
    synchronized (lock) { return map.get(id); }  // O(1) — tra cứu "ngay lập tức", không cần duyệt
}

public boolean Add(T task) {
    ...
    if (map.containsKey(task.id))   // O(1) — kiểm tra trùng ID ngay lập tức
        throw new IllegalArgumentException("ID \"" + task.id + "\" da ton tai");
    ...
}
```

**O(1)** (đọc là "Big-O của 1", hay "thời gian hằng số") nghĩa là: **thời gian thực hiện KHÔNG phụ
thuộc vào số lượng phần tử**. Dù `map` có 10 task hay 10 triệu task, `map.get("B001")` đều nhanh
**như nhau** (gần như tức thì).

### `ArrayList<T>` — Giữ Thứ Tự, Duyệt Tuần Tự

```java
public List<T> getAll() {
    synchronized (lock) { return new ArrayList<>(list); }  // trả về BẢN SAO (snapshot)
}
```

`ArrayList` lưu dữ liệu **theo thứ tự được thêm vào** (giống một dãy/array có thể co giãn). Dùng cho:
- Hiển thị `TableView` trong `TaskListController` — bảng cần hiển thị task theo **thứ tự nhất định**
  (ví dụ thứ tự load từ DB: HIGH priority trước).
- Duyệt `for (T t : getAll())` để tính tổng effort, đếm theo priority/status, v.v.

### Tại Sao `HashMap` KHÔNG Thể Thay Thế Hoàn Toàn `ArrayList`?

`HashMap` (và `HashSet`) **không đảm bảo thứ tự** — khi bạn duyệt qua các phần tử của `HashMap`,
thứ tự có thể "lộn xộn" (phụ thuộc vào hash code, không phải thứ tự bạn `put()` vào). Nếu chỉ dùng
`HashMap`, `TaskListController` sẽ hiển thị task theo thứ tự **ngẫu nhiên/không nhất quán** — UX rất
tệ (mỗi lần load lại, bảng "nhảy" thứ tự).

→ **`HashMap` để TRA CỨU nhanh** (theo `id`), **`ArrayList` để HIỂN THỊ/DUYỆT đúng thứ tự**. Cả 2 đều
trỏ tới **cùng các object `T`** (không phải copy dữ liệu 2 lần — chỉ là 2 "danh sách tham chiếu" tới
cùng các object).

```
map  = {"B001"→objBug1, "F001"→objFeature1, "B002"→objBug2}     ← tra cứu nhanh theo id
list = [objBug1, objFeature1, objBug2]                            ← giữ thứ tự duyệt/hiển thị
              ↑           ↑           ↑
          cùng 1 object Bug/Feature trong heap — map và list chỉ "trỏ tới", không copy
```

### Phải Đồng Bộ Cả Hai Cùng Lúc — Nguồn Gốc Của Bug Tiềm Ẩn

Vì có **2 cấu trúc dữ liệu** đại diện cho **cùng 1 tập dữ liệu**, **mọi method thay đổi dữ liệu phải
cập nhật CẢ HAI**, nếu không 2 cấu trúc sẽ "lệch nhau":

```java
public boolean Add(T task) {
    ...
    synchronized (lock) {
        map.put(task.id, task);   // cập nhật map
        list.add(task);           // VÀ cập nhật list — thiếu 1 trong 2 dòng → map/list không khớp!
    }
    return true;
}

public boolean delete(String id) {
    synchronized (lock) {
        T task = map.get(id);
        if (task == null) return false;
        if (!repo.delete(id)) return false;
        list.remove(task);    // xóa khỏi list
        map.remove(id);       // VÀ xóa khỏi map
    }
    return true;
}
```

> **Bài học thiết kế:** khi bạn dùng 2 cấu trúc dữ liệu để biểu diễn 1 tập hợp logic, hãy **viết tất
> cả method thay đổi (`Add`, `delete`, ...) tại MỘT NƠI** (trong `ProjectService`, không để Controller
> tự ý `list.add(...)`), và luôn cập nhật đồng thời để tránh "data lệch pha".

---

## 4. `LinkedHashMap` — Khi Nào Dùng Thay `HashMap`?

```java
@Override
public Map<String, Integer> countByPriority() {
    Map<String, Integer> result = new LinkedHashMap<>();   // giữ thứ tự CHÈN (insertion order)
    for (T t : getAll()) {
        result.put(t.priority, result.getOrDefault(t.priority, 0) + 1);
    }
    return result;
}
```

`LinkedHashMap` = `HashMap` + **giữ thứ tự chèn vào**. Dùng ở đây vì: khi `showSummary()` in
`countByPriority()` ra console, ta muốn thứ tự xuất hiện **theo thứ tự gặp trong `list`**
(ví dụ `HIGH, MEDIUM, LOW, HIGH, ...` → in ra theo thứ tự key lần đầu xuất hiện: `HIGH`, rồi
`MEDIUM`, rồi `LOW`) — **dễ đọc, có thể dự đoán được** — thay vì thứ tự "ngẫu nhiên" của `HashMap`
thường.

### `getOrDefault(key, default)` — Idiom Đếm Tần Suất Cực Phổ Biến

```java
result.put(t.priority, result.getOrDefault(t.priority, 0) + 1);
```

Đọc từng bước:
1. `result.getOrDefault(t.priority, 0)` — "lấy giá trị hiện tại của `t.priority` trong map; nếu
   **chưa có key này** (lần đầu gặp), trả về `0`."
2. `+ 1` — cộng thêm 1.
3. `result.put(...)` — ghi đè lại giá trị mới.

Ví dụ với dãy priority `["HIGH", "MEDIUM", "HIGH"]`:

```
Bước 1: t.priority = "HIGH"
  getOrDefault("HIGH", 0) → 0 (chưa có)  → 0+1=1  → result = {HIGH: 1}

Bước 2: t.priority = "MEDIUM"
  getOrDefault("MEDIUM", 0) → 0          → 0+1=1  → result = {HIGH: 1, MEDIUM: 1}

Bước 3: t.priority = "HIGH"
  getOrDefault("HIGH", 0) → 1 (đã có)    → 1+1=2  → result = {HIGH: 2, MEDIUM: 1}
```

→ Đây là **idiom (cách viết quen thuộc)** bạn sẽ gặp lại RẤT nhiều trong Java: "đếm số lần xuất hiện
của các giá trị" bằng `Map<KeyType, Integer>` + `getOrDefault(key, 0) + 1`.

---

## 5. `HashSet` — Tập Hợp Không Trùng Lặp

```java
public List<String> findDuplicateIds() {
    Set<String>  seen = new HashSet<>();
    List<String> dups = new ArrayList<>();
    for (T t : getAll()) {
        if (!seen.add(t.id.toLowerCase()) && !dups.contains(t.id))
            dups.add(t.id);
    }
    return dups;
}
```

`HashSet<String>` là một **tập hợp (set)** — giống `HashMap` nhưng **chỉ lưu Key, không có Value**,
và **không cho phép phần tử trùng nhau**.

### `seen.add(x)` Trả Về `boolean` — Điểm Mấu Chốt

`Set.add(x)`:
- Trả về **`true`** nếu `x` **CHƯA có** trong set (và đã thêm thành công).
- Trả về **`false`** nếu `x` **ĐÃ có** trong set (không thêm gì cả — set không thay đổi).

```java
if (!seen.add(t.id.toLowerCase()) && !dups.contains(t.id))
    dups.add(t.id);
```

Đọc là: *"NẾU `seen.add(...)` trả về `false` (nghĩa là ID này đã từng thấy trước đó — trùng!) VÀ ID
này chưa có trong `dups` (tránh thêm trùng lặp 2 lần vào `dups` nếu có 3+ task cùng ID) → thêm vào
danh sách trùng."*

`.toLowerCase()` — chuẩn hóa chữ hoa/thường, vì "B001" và "b001" nên được coi là **cùng 1 ID** khi
kiểm tra trùng (dù `Add()` đã `toUpperCase()` khi nhập, hàm này vẫn phòng hờ trường hợp dữ liệu cũ
trong DB có case khác nhau).

> Chi tiết thuật toán (đây là biến thể của **LeetCode #217 "Contains Duplicate"**) sẽ được giải
> thích sâu hơn ở `KienThuc_08`.

---

## 6. Java Stream — Cách Viết "Khai Báo" (Declarative) Trên Collection

`ProjectService` dùng Stream ở vài chỗ ngắn:

```java
public int countBugs()     { return (int) getAll().stream().filter(t -> t instanceof Bug).count(); }
public int countFeatures() { return (int) getAll().stream().filter(t -> t instanceof Feature).count(); }
```

So sánh cách viết "cũ" (vòng `for`) và Stream:

```java
// Cách "cũ" — vòng for tường minh (imperative — khai báo TỪNG BƯỚC làm gì)
int count = 0;
for (T t : getAll()) {
    if (t instanceof Bug) count++;
}

// Cách Stream (declarative — khai báo "CÁI GÌ", Java tự lo "LÀM SAO")
int count = (int) getAll().stream().filter(t -> t instanceof Bug).count();
```

- `.stream()` — biến `List<T>` thành một "luồng" phần tử để xử lý theo chuỗi (pipeline).
- `.filter(t -> t instanceof Bug)` — **chỉ giữ lại** các phần tử thỏa điều kiện (đây là một
  **lambda expression** — hàm "không tên": `t -> <điều kiện>`, đọc là *"với mỗi `t`, kiểm tra `t
  instanceof Bug"*).
- `.count()` — đếm số phần tử còn lại sau filter, trả về `long` → `(int)` để ép về `int`.

`TaskListController.handleFilter()` cũng dùng Stream:

```java
filtered = filtered.stream()
    .filter(task -> task.getTypeCode().equals(t))
    .collect(java.util.stream.Collectors.toList());
```

`.collect(Collectors.toList())` — "thu hoạch" kết quả từ stream **trở lại thành `List`** (vì stream
chỉ là một "luồng xử lý tạm thời", không tự lưu thành collection).

> **Khi nào dùng Stream, khi nào dùng `for`?** Cả hai đều đúng — Stream phù hợp cho các xử lý
> **ngắn, một dòng** (filter/count/map đơn giản). Vòng `for` rõ ràng hơn khi logic **phức tạp, nhiều
> bước, cần `break`/early return** (ví dụ `loadFromDB()`, `findDuplicateIds()` trong project này vẫn
> dùng `for` vì logic có nhiều bước).

---

## 7. Tóm Tắt

| Cấu trúc | Đặc điểm | Dùng khi nào trong `ProjectService` |
|---|---|---|
| `HashMap<String, T>` | Tra cứu theo key O(1), KHÔNG giữ thứ tự | `findById()`, kiểm tra trùng `id` trong `Add()` |
| `ArrayList<T>` | Giữ thứ tự chèn, duyệt tuần tự | `getAll()`, hiển thị `TableView`, tính tổng effort |
| `LinkedHashMap<K,V>` | = HashMap + giữ thứ tự chèn | `countByPriority()`, `countByStatus()` — kết quả dễ đọc, có thứ tự |
| `HashSet<String>` | Tập hợp không trùng, kiểm tra "đã thấy chưa" O(1) | `findDuplicateIds()` |
| `<T extends Task>` | Generic có giới hạn — `T` chắc chắn có field/method của `Task` | Toàn bộ `ProjectService<T extends Task>` |
| Stream + lambda | Xử lý collection theo kiểu khai báo, ngắn gọn | `countBugs()`, `countFeatures()`, filter trong `TaskListController` |

---

**Tiếp theo:** `ProjectManagerApp_KienThuc_04_ExceptionHandling.md` — `try/catch/finally`,
`AppException` tự định nghĩa, và cách `Validator` biến lỗi "khó hiểu" thành message hiển thị được
trên UI.
