# ProjectManagerApp — Kiến Thức 06: Multithreading (Thread, synchronized, Platform.runLater)

> File code liên quan: `ProjectService.loadFromDBAsync()`, `ProjectService.totalEffortAsync()`,
> `DashboardController.initialize()`, `TaskListController.handleReload()`
> (xem `ProjectManagerApp_Guide_03_Service.md`, mục "Giải Thích Chi Tiết")

---

## 1. Thread Là Gì? — "Một Chương Trình Có Thể Làm Nhiều Việc 'Song Song'"

**Thread (luồng)** là một "dòng chảy thực thi code" độc lập. Một chương trình Java **luôn có ít nhất
1 thread** (gọi là **main thread**). Bạn có thể tạo thêm các thread khác để **chạy code song song**
(hoặc "đan xen" — interleaved, tùy số CPU core thực tế).

```java
Thread worker = new Thread(() -> {
    // code chạy TRONG thread "worker" — KHÔNG PHẢI main thread
    loadFromDB();
}, "load-db-thread");   // "load-db-thread" = TÊN của thread (để debug dễ hơn)
worker.start();   // bắt đầu chạy — KHÔNG block, dòng code TIẾP THEO chạy NGAY
```

`new Thread(...)` nhận một **lambda** (`() -> { ... }`) — đây là cú pháp ngắn gọn của Java cho
**`Runnable`** (một interface chỉ có 1 method `run()` không tham số, không trả về gì). `.start()`
**không chờ** code trong lambda chạy xong — nó "giao việc" cho thread mới rồi **trả lại quyền điều
khiển ngay** cho dòng code gọi `.start()`.

---

## 2. JavaFX UI Thread (Application Thread) — Luật Số 1 Của JavaFX

JavaFX có **1 thread đặc biệt** gọi là **"JavaFX Application Thread"** (hay "UI thread"). **TẤT CẢ**
thao tác vẽ/cập nhật giao diện (`Label.setText()`, `TableView.setItems()`, vẽ lại màn hình khi user
bấm nút...) đều chạy trên thread này — và **CHỈ thread này được phép làm việc đó**.

### Vấn Đề: Nếu Code "Nặng" Chạy Trên UI Thread

```java
// ❌ SAI — chạy trực tiếp trên UI thread
@Override
public void initialize(URL url, ResourceBundle rb) {
    service.loadFromDB();          // ← câu lệnh SQL "SELECT * FROM Tasks" — có thể tốn 0.5-2 giây
    updateTable(service.getAll()); // ← chỉ chạy SAU KHI loadFromDB() xong
}
```

Trong lúc `loadFromDB()` đang chạy (chờ SQL Server trả kết quả qua network), **UI thread bị "chiếm
dụng"** — nó không thể xử lý bất kỳ sự kiện nào khác: cửa sổ **không phản hồi** khi bạn click, kéo,
hay **resize** — hệ điều hành có thể hiện "Not Responding" (đơ/treo). Đây gọi là **"blocking the UI
thread"** (chặn luồng giao diện) — một trong những lỗi UX phổ biến nhất ở app có giao diện.

### Giải Pháp: Background Thread + Callback

```java
// ✅ ĐÚNG — async (bất đồng bộ)
@Override
public void initialize(URL url, ResourceBundle rb) {
    lblStats.setText("Dang tai du lieu...");   // (1) hiện ngay — UI vẫn mượt

    service.loadFromDBAsync(() -> {            // (2) loadFromDB() chạy ở THREAD KHÁC
        // (3) code này chạy SAU khi load xong, NHƯNG được đưa LẠI vào UI thread
        Map<String, Integer> byStatus   = service.countByStatus();
        Map<String, Integer> byPriority = service.countByPriority();
        lblStats.setText(String.format("Tong: %d task ...", ...));
    });

    // (4) dòng này chạy NGAY, KHÔNG chờ loadFromDBAsync xong
}
```

Luồng thời gian:

```
Thời điểm 0ms:   initialize() bắt đầu
                  lblStats.setText("Dang tai du lieu...")   ← user thấy NGAY
                  loadFromDBAsync() được gọi → tạo thread "load-db-thread" → start()
                  initialize() KẾT THÚC (return) — UI vẫn responsive, user click được mọi nơi khác

Thread "load-db-thread" (chạy NGẦM, song song):
Thời điểm 0-800ms:  loadFromDB() đang chạy (chờ SQL Server)
Thời điểm 800ms:    loadFromDB() xong → gọi Platform.runLater(callback)

UI thread (thời điểm ~800ms, "khi nó rảnh"):
                  chạy callback → lblStats.setText("Tong: 5 task | Bug: 3 ...")
```

→ Trong 800ms đó, **user vẫn dùng được app bình thường** (chuyển màn hình, click nút khác...) — chỉ
có dòng `lblStats` "Dang tai du lieu..." hiển thị tạm cho tới khi dữ liệu thật về.

---

## 3. `loadFromDBAsync()` — Code Đầy Đủ, Giải Thích Từng Dòng

```java
public Thread loadFromDBAsync(Runnable onComplete) {
    Thread worker = new Thread(() -> {
        loadFromDB();                                    // (A) chạy trên thread MỚI
        if (onComplete != null) Platform.runLater(onComplete);  // (B)
    }, "load-db-thread");
    worker.setDaemon(true);                              // (C)
    worker.start();                                      // (D)
    return worker;
}

public Thread loadFromDBAsync() { return loadFromDBAsync(null); }   // (E) overload
```

- **(A)** `loadFromDB()` — chứa câu lệnh `repo.findAll()` (SQL `SELECT`) — đây là phần "nặng",
  được "đẩy" sang thread riêng.
- **(B)** `Platform.runLater(onComplete)` — **đây là điểm MẤU CHỐT**. `onComplete` (callback do
  `DashboardController` truyền vào — chứa `lblStats.setText(...)`) **CHỨA code cập nhật UI** →
  KHÔNG thể chạy trực tiếp trên `load-db-thread` (vi phạm "Luật số 1"). `Platform.runLater(...)`
  nghĩa là: *"Này JavaFX UI thread, khi nào bạn rảnh, hãy chạy đoạn code này"* — nó đưa `onComplete`
  vào một **hàng đợi (queue)** mà UI thread sẽ xử lý lần lượt.
- **(C)** `worker.setDaemon(true)` — xem mục 4 dưới.
- **(D)** `worker.start()` — **bắt đầu chạy** thread (gọi `run()` của lambda trên 1 thread mới).
  ⚠️ Lưu ý: **không** gọi `worker.run()` trực tiếp — nếu gọi `.run()`, code sẽ chạy **ngay trên
  thread hiện tại** (= UI thread), **mất hết** ý nghĩa của việc tạo Thread riêng!
- **(E)** Method overload (2 phiên bản cùng tên, khác số tham số) — `loadFromDBAsync()` (không
  callback) gọi `loadFromDBAsync(null)`, và bên trong `if (onComplete != null)` đảm bảo không gọi
  `Platform.runLater(null)` (sẽ lỗi). Dùng khi bạn chỉ cần load dữ liệu, không cần làm gì thêm sau
  đó.

### `Thread` Trả Về Để Làm Gì?

`loadFromDBAsync()` trả về `Thread worker` — trong project này, giá trị trả về **không được
Controller sử dụng** (`service.loadFromDBAsync(() -> {...});` — bỏ qua kết quả). Nhưng việc trả về
`Thread` **cho phép tương lai** caller có thể gọi `worker.join()` (chờ thread xong) hoặc kiểm tra
`worker.isAlive()` nếu cần — một thiết kế API "mở", không bắt buộc dùng ngay.

---

## 4. `setDaemon(true)` — "Thread Phụ, Không Giữ Chân App"

```java
worker.setDaemon(true);
```

Java phân loại thread thành 2 nhóm:
- **User thread** (mặc định): JVM (Java Virtual Machine) **chờ TẤT CẢ user thread hoàn thành** rồi
  mới thực sự kết thúc chương trình.
- **Daemon thread** (`setDaemon(true)`): JVM **KHÔNG chờ** — nếu user đóng app (đóng cửa sổ JavaFX)
  khi `load-db-thread` đang chạy giữa đường, JVM **thoát ngay**, "bỏ rơi" thread đó giữa chừng.

### Tại Sao `load-db-thread` Nên Là Daemon?

Nếu user bấm "X" đóng app **ngay khi** `loadFromDBAsync()` đang chạy (ví dụ user vừa login, app
đang load task list, user đổi ý đóng app ngay lập tức):

- **Nếu KHÔNG đặt daemon**: app "treo" thêm vài trăm ms-vài giây — JVM phải chờ
  `load-db-thread` chạy xong `loadFromDB()` rồi mới cho phép app thoát hoàn toàn. User cảm thấy
  "bấm X mà app không tắt ngay".
- **Nếu đặt `setDaemon(true)`**: app thoát **ngay lập tức** khi user bấm X — `load-db-thread` bị
  "giết" giữa đường, nhưng **không sao** vì: (1) app đã đóng, không còn UI để cập nhật; (2)
  `loadFromDB()` chỉ **đọc** dữ liệu (không phải đang ghi/transaction nửa chừng) — bị ngắt giữa
  đường không làm hỏng dữ liệu DB.

> **Quy tắc chọn lựa:** Đặt `daemon = true` cho các **background task không quan trọng nếu bị ngắt
> giữa đường** (load dữ liệu để hiển thị, tính toán thống kê). **KHÔNG** đặt daemon cho các thread
> đang thực hiện **ghi dữ liệu quan trọng** (ví dụ: đang lưu file, đang transaction DB nhiều bước) —
> những việc đó cần hoàn thành trọn vẹn dù app đang đóng.

---

## 5. Race Condition — "2 Thread Cùng Đụng Vào 1 Dữ Liệu, Kết Quả Sai Khó Lường"

### Kịch Bản Cụ Thể Trong `ProjectManagerApp`

```
UI Thread (JavaFX)                           "load-db-thread" (background)
──────────────────                           ──────────────────────────────
TaskListController.initialize()
  → service.getAll()
      → đọc `list`  ──────┐
                           │     CÙNG LÚC:    loadFromDBAsync() đang chạy
                           │                    → loadFromDB()
                           │                        → list.clear()       ← XÓA list
                           └──── 💥 list đang bị         → map.clear()
                                  đọc dở (for loop)        → list.addAll(tempList)  ← THÊM lại
                                  thì BỊ XÓA giữa đường!
```

Nếu `getAll()` đang **duyệt** `list` (ví dụ trong `for (T t : list)`) **đúng lúc**
`loadFromDB()` gọi `list.clear()` — Java có thể ném
**`ConcurrentModificationException`** (nếu dùng for-each trên collection đang bị sửa), hoặc tệ hơn,
trả về **dữ liệu nửa-cũ-nửa-mới** (vài phần tử cũ + vài phần tử mới) — UI hiển thị **sai lệch**,
không crash nhưng dữ liệu vô nghĩa.

→ **Race condition (tranh chấp luồng)**: kết quả của chương trình phụ thuộc vào **"thread nào chạy
tới trước"** — một điều **không thể dự đoán/lặp lại** (lúc chạy thì OK, lúc khác lại lỗi — rất khó
debug!).

---

## 6. `synchronized` — "Chỉ 1 Thread Được Vào Phòng Này Tại Một Thời Điểm"

```java
private final Object lock = new Object();   // object dùng làm "khóa"

public boolean Add(T task) {
    try {
        ...
        synchronized (lock) {
            map.put(task.id, task);
            list.add(task);
        }
        return true;
    } catch (...) { ... } finally { ... }
}

public void loadFromDB() {
    List<Task> dbList = repo.findAll();
    Map<String, T> tempMap  = new HashMap<>();
    List<T>        tempList = new ArrayList<>();
    for (Task t : dbList) { /* build vào temp, KHÔNG động vào map/list chính */ }

    synchronized (lock) {     // ← chỉ "chốt" (swap) trong khoảng RẤT NGẮN
        map.clear();  list.clear();
        map.putAll(tempMap);  list.addAll(tempList);
    }
}

public List<T> getAll() {
    synchronized (lock) { return new ArrayList<>(list); }   // copy NHANH rồi thả lock
}
```

### `synchronized (lock) { ... }` Hoạt Động Như Thế Nào?

Hãy tưởng tượng `lock` là một **chiếc chìa khóa duy nhất** của 1 căn phòng (`map` + `list`):
- Thread nào vào block `synchronized (lock) { ... }` trước sẽ **"cầm chìa khóa"** — các thread khác
  muốn vào block `synchronized (lock) { ... }` (BẤT KỲ block nào, miễn là dùng **cùng object
  `lock`**) phải **đợi**.
- Khi thread đó ra khỏi block `{ }`, nó "trả lại chìa khóa" — thread đang đợi (nếu có) được vào.

```
Timeline:
  load-db-thread: synchronized(lock) { map.clear(); list.clear(); map.putAll(...); list.addAll(...); }
                   ─────────────────── đang giữ lock ───────────────────

  UI thread:       service.getAll() → synchronized(lock) { return new ArrayList<>(list); }
                   ........ ĐANG ĐỢI (lock đang bị giữ) ........ → vào được khi load-db-thread xong
```

→ Vì cả `Add()`, `loadFromDB()`, `getAll()`, `delete()`, `reverseOrder()` đều `synchronized` trên
**cùng 1 object `lock`**, **không bao giờ** có 2 thread cùng đọc/ghi `map`/`list` đồng thời — race
condition ở mục 5 **không thể xảy ra**.

### Tại Sao Dùng `private final Object lock = new Object()` Riêng, Không `synchronized` Cả Method?

```java
// Cách khác — synchronized trên CẢ METHOD (synchronized method)
public synchronized List<T> getAll() { return new ArrayList<>(list); }
```

Cả 2 cách đều hợp lệ. Nhưng dùng **1 object `lock` riêng, dùng chung cho nhiều method** (`Add`,
`delete`, `getAll`, `loadFromDB`, `reverseOrder`) đảm bảo **TẤT CẢ các method này loại trừ lẫn
nhau** (cùng 1 "chìa khóa"). Nếu mỗi method tự `synchronized` trên `this` (ngầm định khi dùng
`synchronized` trên method instance), về bản chất tương tự — nhưng dùng `lock` riêng là cách viết
**rõ ràng hơn về Ý ĐỊNH**: "biến `lock` này CHỈ TỒN TẠI để bảo vệ `map` và `list`", tránh nhầm lẫn
với các mục đích khác.

### "Snapshot Pattern" — Giữ Lock CÀNG NGẮN CÀNG TỐT

```java
public List<T> getAll() {
    synchronized (lock) { return new ArrayList<>(list); }  // copy TOÀN BỘ list → trả về copy
}
```

`new ArrayList<>(list)` tạo ra **một bản sao (snapshot)** của `list` tại thời điểm đó. Sau khi
`getAll()` return, code gọi nó (`TaskListController.loadData(service.getAll())`) làm việc với
**bản sao** — dù `load-db-thread` sau đó có `list.clear()` thì **bản sao đã trả về không bị ảnh
hưởng** (vì nó là 1 `ArrayList` MỚI, độc lập, chỉ chứa **tham chiếu** tới các object `Task` tại thời
điểm copy).

→ Đây là lý do `synchronized (lock) { return new ArrayList<>(list); }` chỉ giữ lock **trong khoảnh
khắc copy** (rất nhanh — O(n) nhưng không có I/O), rồi **thả lock ngay** — các bước tiếp theo
(`sort`, `filter`, hiển thị TableView) chạy **ngoài lock**, không làm các thread khác phải đợi lâu.

> **Nguyên tắc chung:** Giữ `synchronized` block **càng ngắn càng tốt** — chỉ bọc đúng phần code
> *thực sự* đọc/ghi dữ liệu chia sẻ. Block `synchronized` dài (chứa I/O, tính toán nặng, gọi DB...)
> làm các thread khác phải đợi lâu — gọi là **"lock contention"** (tranh chấp khóa), khiến app
> "đơ" dù không hẳn là deadlock.

---

## 7. `Consumer<Integer>` — "Callback Nhận 1 Giá Trị, Không Trả Về Gì"

```java
public Thread totalEffortAsync(Consumer<Integer> onResult) {
    Thread worker = new Thread(() -> {
        int total = 0;
        for (T t : getAll()) total += t.GetEffort();
        final int result = total;
        Platform.runLater(() -> onResult.accept(result));
    }, "effort-thread");
    worker.setDaemon(true);
    worker.start();
    return worker;
}
```

`Consumer<T>` là một **functional interface** có sẵn trong Java (`java.util.function.Consumer`) —
chỉ có 1 method: `void accept(T value)`. "Consumer" (người tiêu thụ) — nhận 1 giá trị vào, **làm gì
đó với nó, không trả ra giá trị mới** (khác với `Function<T,R>` — nhận vào và TRẢ VỀ).

Cách gọi (giả định, không có trong code controller hiện tại nhưng minh họa cách dùng):

```java
service.totalEffortAsync(total -> {
    lblEffort.setText("Tong effort: " + total + "h");   // total là Integer, code chạy trên UI thread
});
```

- `total -> { lblEffort.setText(...) }` — lambda này **LÀ** implementation của
  `Consumer<Integer>.accept(Integer total)`.
- Bên trong `totalEffortAsync`, `onResult.accept(result)` được gọi **bên trong
  `Platform.runLater(...)`** — đảm bảo `lblEffort.setText()` chạy trên UI thread, dù việc TÍNH
  TOÁN `total` (`for (T t : getAll()) total += t.GetEffort();`) chạy trên `effort-thread`.

### `final int result = total;` — Vì Sao Cần Biến `final` Mới?

```java
int total = 0;
for (T t : getAll()) total += t.GetEffort();
final int result = total;                         // copy sang biến MỚI, final
Platform.runLater(() -> onResult.accept(result));  // lambda CHỈ dùng được biến "effectively final"
```

Lambda trong Java **chỉ được "capture" (bắt giữ) các biến local là `final` hoặc "effectively
final"** (biến chỉ gán giá trị 1 lần, dù không có từ khóa `final`). Biến `total` được **gán lại
nhiều lần** trong vòng `for` (`total += ...`) → **không phải effectively final** → lambda
`() -> onResult.accept(total)` sẽ **lỗi compile** nếu dùng trực tiếp `total`. Giải pháp: copy giá
trị cuối cùng của `total` sang một biến **mới**, **chỉ gán 1 lần** (`result`) — lambda dùng `result`
thì hợp lệ.

> **Lý do kỹ thuật (không cần nhớ sâu, chỉ cần hiểu hiện tượng):** lambda có thể được thực thi
> **muộn hơn**, ở **thread khác** — nếu nó "bắt giữ" 1 biến **có thể bị thay đổi sau đó**, giá trị
> dùng trong lambda sẽ "lúc đúng lúc sai", rất khó debug. Java **chặn việc này ngay từ compile time**
> bằng quy tắc "chỉ capture biến final/effectively final".

---

## 8. Tóm Tắt — Quy Tắc "3 Chữ" Cho Multithreading + JavaFX

1. **TÁCH** — việc nặng (DB, file, network) → `new Thread(...)`, `setDaemon(true)`, `.start()`.
2. **KHÓA** — dữ liệu dùng chung giữa thread (`map`, `list`) → `synchronized (lock) { ... }`, giữ
   block càng ngắn càng tốt (snapshot pattern: copy rồi trả ra ngay).
3. **VỀ** — bất kỳ code cập nhật UI (`Label`, `TableView`...) sau khi xử lý xong ở background thread
   → PHẢI đưa "về" UI thread bằng `Platform.runLater(() -> { ... })`.

```
   [UI Thread]                    [Background Thread]
       │                                  │
       │── new Thread(...).start() ─────►│
       │   (không chờ — return ngay)     │  loadFromDB() / tính toán nặng
       │                                  │  synchronized(lock) { đọc/ghi map, list }
       │                                  │
       │◄──── Platform.runLater(...) ────│  (đưa code cập nhật UI "về" UI thread)
       │  setText/setItems chạy ở đây    │
```

---

**Tiếp theo:** `ProjectManagerApp_KienThuc_07_JavaFX_CoBan.md` — FXML, Controller, Scene/Stage,
`@FXML`, Properties (`SimpleStringProperty`), `TableView`/`CellFactory`, và CSS trong JavaFX.
