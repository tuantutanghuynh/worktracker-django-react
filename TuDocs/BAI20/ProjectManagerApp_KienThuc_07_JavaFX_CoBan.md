# ProjectManagerApp — Kiến Thức 07: JavaFX Cơ Bản (FXML, Controller, Scene, TableView, CSS)

> File code liên quan: `App.java`, `SceneSwitcher.java`, tất cả `*Controller.java`, tất cả `*.fxml`,
> `main.css` (xem `ProjectManagerApp_Guide_05_Controllers.md`, `Guide_06_FXML_CSS.md`)

---

## 1. JavaFX Là Gì? Stage — Scene — Node

JavaFX là thư viện xây dựng **giao diện đồ họa (GUI)** cho Java. Có 3 khái niệm lồng nhau cần nhớ:

```
Stage (cửa sổ ứng dụng — CHỈ CÓ 1 trong app này, gọi là "primaryStage")
  └── Scene (1 "màn hình" — nội dung HIỆN TẠI đang hiển thị trong Stage)
        └── Node (mọi thứ NHÌN THẤY ĐƯỢC: Button, Label, TextField, VBox, TableView...)
              └── Node con của Node (VBox chứa nhiều Label/Button...)
```

- **`Stage`** = cái cửa sổ (window) — có thể `.show()`, `.setTitle()`, `.setResizable()`.
- **`Scene`** = nội dung **bên trong** cửa sổ tại 1 thời điểm — `Stage.setScene(scene)` để **đổi
  toàn bộ nội dung** (giống "đổi cảnh" trong phim).
- **`Node`** = bất kỳ thành phần UI nào (`Button`, `Label`, `TextField`, `TableView`, hoặc các
  **layout container** như `VBox`, `HBox`, `BorderPane` — chứa các Node con khác).

### `App.java` — Điểm Khởi Đầu

```java
public class App extends Application {

    @Override
    public void start(Stage primaryStage) throws IOException {
        SceneSwitcher.setStage(primaryStage);     // lưu lại Stage để dùng ở mọi nơi khác
        primaryStage.setTitle("Project Manager");
        primaryStage.setResizable(false);

        FXMLLoader loader = new FXMLLoader(
            App.class.getResource("/com/projectmanager/ui/views/login.fxml"));
        primaryStage.setScene(new Scene(loader.load()));  // Scene đầu tiên = login.fxml
        primaryStage.show();
    }

    public static void main(String[] args) {
        launch(args);   // launch() KHỞI ĐỘNG JavaFX runtime, rồi gọi start() ở trên
    }
}
```

- `extends Application` — bắt buộc đối với class chính của bất kỳ app JavaFX.
- `launch(args)` — **không phải** bạn tự gọi `start()`. JavaFX framework khởi tạo môi trường đồ họa,
  tạo `primaryStage`, rồi **tự gọi** `start(primaryStage)`. Đây giống cách Spring/Android framework
  gọi các "lifecycle method" của bạn — bạn **viết** `start()`, framework **gọi** nó.
- `FXMLLoader` — đọc file `.fxml` (XML mô tả UI) và **dựng** cây Node tương ứng trong bộ nhớ.
  `loader.load()` trả về **root Node** (ở đây là `<AnchorPane>` của `login.fxml`).

---

## 2. FXML — Mô Tả UI Bằng XML (Declarative UI)

`login.fxml` (rút gọn):

```xml
<AnchorPane prefHeight="500.0" prefWidth="400.0"
            xmlns:fx="http://javafx.com/fxml/1"
            fx:controller="com.projectmanager.ui.controllers.LoginController"
            stylesheets="@../styles/main.css">

    <VBox alignment="CENTER" spacing="16" ...>
        <Label text="Project Manager" styleClass="title"/>
        <TextField fx:id="txtUsername" promptText="Nhap username" styleClass="field"/>
        <PasswordField fx:id="txtPassword" promptText="Nhap mat khau" styleClass="field"/>
        <Button text="Dang Nhap" onAction="#handleLogin" styleClass="btn-primary" defaultButton="true"/>
        <Label fx:id="lblMessage" wrapText="true"/>
    </VBox>
</AnchorPane>
```

### Tại Sao Tách UI (FXML) Ra Khỏi Code (Java)?

So sánh với cách viết JavaFX **không dùng FXML** (gọi là "code thuần"):

```java
// CÁCH KHÔNG DÙNG FXML — tạo Node bằng code Java
VBox root = new VBox(16);
root.setAlignment(Pos.CENTER);
Label title = new Label("Project Manager");
title.getStyleClass().add("title");
TextField txtUsername = new TextField();
txtUsername.setPromptText("Nhap username");
Button btnLogin = new Button("Dang Nhap");
btnLogin.setOnAction(e -> handleLogin());
root.getChildren().addAll(title, txtUsername, btnLogin);
```

→ Cách này **trộn lẫn** "cấu trúc UI" (cái gì nằm ở đâu) với "logic xử lý" (`handleLogin()`) trong
**cùng 1 file Java** — khó đọc khi UI phức tạp, và **designer (người làm UI/UX)** không thể chỉnh
sửa layout mà không đọc/hiểu code Java.

**FXML** tách 2 việc:
- **`.fxml`** — "trông như thế nào" (cấu trúc, layout, text tĩnh, style class) — gần giống HTML.
- **`Controller.java`** — "hoạt động ra sao" (xử lý khi click, validate, gọi service...).

→ Đây là một dạng của nguyên tắc **Separation of Concerns** đã thấy ở `KienThuc_00` (layered
architecture) — áp dụng ở quy mô nhỏ hơn, cho riêng tầng UI.

---

## 3. `fx:controller` + `@FXML` — "Sợi Dây" Kết Nối FXML ↔ Java

```xml
<AnchorPane ... fx:controller="com.projectmanager.ui.controllers.LoginController" ...>
    <TextField fx:id="txtUsername" .../>
    <Button text="Dang Nhap" onAction="#handleLogin" .../>
</AnchorPane>
```

```java
public class LoginController implements Initializable {

    @FXML private TextField     txtUsername;   // fx:id="txtUsername" → field này
    @FXML private PasswordField txtPassword;
    @FXML private Label         lblMessage;

    @Override
    public void initialize(URL url, ResourceBundle rb) {
        lblMessage.setText("");
    }

    @FXML
    private void handleLogin() throws IOException {   // onAction="#handleLogin" → method này
        ...
    }
}
```

### Cơ Chế "Injection" (Tiêm Phụ Thuộc) Của `FXMLLoader`

Khi `FXMLLoader.load()` chạy:
1. Đọc `fx:controller="..."` → tạo 1 object `LoginController` (gọi `new LoginController()` — **bạn
   không tự gọi `new`**, framework làm thay).
2. Với mỗi tag có `fx:id="xxx"`, FXMLLoader tìm field **cùng tên `xxx`**, có annotation `@FXML`,
   trong `LoginController` → **gán Node tương ứng vào field đó** (gọi là "field injection").
3. Với mỗi `onAction="#yyy"`, FXMLLoader tìm method `yyy()` có `@FXML` → **đăng ký** method này làm
   "event handler" — khi user bấm nút, method `yyy()` được gọi.
4. **Sau khi** mọi field `@FXML` đã được gán xong, FXMLLoader gọi `initialize(url, rb)` (nếu
   controller `implements Initializable`).

```
FXML: <TextField fx:id="txtUsername"/>     Java: @FXML private TextField txtUsername;
                    │                                        ▲
                    └──────────── fx:id PHẢI KHỚP TÊN FIELD ─┘
                       (sai tên / quên @FXML → field = null → NullPointerException khi dùng!)
```

> **Lỗi rất hay gặp:** Đặt `fx:id="txtUsername"` trong FXML nhưng field Java tên `txtUserName`
> (khác hoa/thường) hoặc quên `@FXML` → field **không được inject**, vẫn là `null` → khi
> `initialize()` gọi `txtUsername.setText(...)` → **`NullPointerException`** ngay khi mở màn hình.

### `implements Initializable` — `initialize()` Là Gì?

```java
public class LoginController implements Initializable {
    @Override
    public void initialize(URL url, ResourceBundle rb) {
        lblMessage.setText("");
        // ... setup ban đầu: đổ dữ liệu vào ComboBox, set giá trị mặc định, load data từ Service...
    }
}
```

`initialize()` là **method được gọi TỰ ĐỘNG ngay sau khi** mọi field `@FXML` đã có giá trị (không
còn `null`) — đây là nơi **chuẩn** để: đổ data vào `ComboBox` (`cbPriority.getItems().addAll(...)`),
set giá trị mặc định, gọi `loadFromDBAsync()`, kiểm tra quyền (`UserSession.isAdmin()`), v.v.
Không nên đặt code này trong constructor của Controller — vì lúc constructor chạy, **các field
`@FXML` CHƯA được inject** (vẫn là `null`).

---

## 4. `SceneSwitcher` — Chuyển Đổi Giữa Các Màn Hình

```java
public class SceneSwitcher {

    private static Stage stage;   // Singleton-style static field — giống UserSession (KienThuc_02)

    public static void setStage(Stage s) { stage = s; }

    public static void switchScene(String fxml) throws IOException {
        FXMLLoader loader = new FXMLLoader(
            App.class.getResource("/com/projectmanager/ui/views/" + fxml));
        stage.setScene(new Scene(loader.load()));
    }

    public static <C> C switchSceneAndGetController(String fxml) throws IOException {
        FXMLLoader loader = new FXMLLoader(
            App.class.getResource("/com/projectmanager/ui/views/" + fxml));
        stage.setScene(new Scene(loader.load()));
        return loader.getController();
    }
}
```

- `switchScene("dashboard.fxml")` — load FXML mới, tạo `Scene` mới, gọi `stage.setScene(...)` →
  **toàn bộ nội dung cửa sổ** đổi từ màn hình cũ sang `dashboard.fxml`. Cửa sổ (`Stage`) **vẫn là
  1 cái duy nhất** — chỉ "nội dung bên trong" (Scene) thay đổi.
- `App.class.getResource("/com/projectmanager/ui/views/" + fxml)` — đường dẫn bắt đầu bằng `/` là
  **classpath root** (gốc của thư mục đã compile, `build/classes/`) — khác với đường dẫn trong FXML
  (`stylesheets="@../styles/main.css"`, bắt đầu bằng `@`) là đường dẫn **tương đối tính từ file FXML
  hiện tại**. Hai loại đường dẫn này **dễ nhầm** — đây là lưu ý quan trọng trong
  `Guide_06_FXML_CSS.md`.

### `<C> C switchSceneAndGetController(...)` — Generic Method (Không Phải Generic Class!)

```java
public static <C> C switchSceneAndGetController(String fxml) throws IOException { ... }
```

Khác với `ProjectService<T extends Task>` (generic **class**, `KienThuc_03`), đây là **generic
method** — `<C>` chỉ tồn tại "cục bộ" cho method này. `loader.getController()` trả về `Object` (vì
`FXMLLoader` không biết controller cụ thể là gì) — generic `<C>` cho phép **caller tự chỉ định kiểu
mong muốn**, tránh phải `(SomeController) loader.getController()` (cast thủ công) ở mọi nơi gọi.

```java
// Ví dụ cách dùng (minh họa — không có trong code hiện tại):
TaskListController ctrl = SceneSwitcher.switchSceneAndGetController("task_list.fxml");
// <C> được Java TỰ SUY RA là TaskListController, dựa vào kiểu biến `ctrl`
```

---

## 5. Layout Containers — "Sắp Xếp" Các Node

| Container | Sắp xếp như thế nào? | Dùng ở đâu trong project |
|---|---|---|
| `VBox` | Xếp các con theo **chiều dọc** (Vertical) | Form login/register, mỗi nhóm field trong `add_task.fxml` |
| `HBox` | Xếp các con theo **chiều ngang** (Horizontal) | Header (logo + nút logout), toolbar filter trong `task_list.fxml` |
| `BorderPane` | 5 vùng: `top`, `bottom`, `left`, `right`, `center` | `dashboard.fxml`, `task_list.fxml`, `user_list.fxml` |
| `AnchorPane` | "Neo" (anchor) con vào 4 cạnh bằng khoảng cách cố định (`AnchorPane.topAnchor`...) | `login.fxml`, `register.fxml` |
| `ScrollPane` | Cho phép cuộn nếu nội dung dài hơn vùng hiển thị | `add_task.fxml` (form dài) |

### `dashboard.fxml` — Ví Dụ `BorderPane`

```xml
<BorderPane ... fx:controller="...DashboardController" ...>
    <top>    <HBox styleClass="header"> ... nút logout ... </HBox>            </top>
    <left>   <VBox styleClass="sidebar"> ... nút điều hướng ... </VBox>       </left>
    <center> <VBox> ... thống kê ... </VBox>                                  </center>
</BorderPane>
```

`BorderPane` chia màn hình thành 5 vùng (`top`/`bottom`/`left`/`right`/`center`) — mỗi vùng chứa
**đúng 1 Node** (thường là 1 container khác như `VBox`/`HBox` chứa nhiều Node con). `center` tự động
**giãn ra** lấp đầy phần còn lại — phù hợp cho "khung sườn app" (header + sidebar + nội dung chính),
một layout cực kỳ phổ biến trong UI thực tế (web, desktop, mobile).

### Thuộc Tính Co Giãn: `HBox.hgrow`, `VBox.vgrow`

```xml
<HBox spacing="16">
    <Label text="Task ID" prefWidth="160"/>
    <TextField fx:id="txtId" HBox.hgrow="ALWAYS"/>   <!-- chiếm hết phần ngang còn lại -->
</HBox>
```

```xml
<TableView fx:id="tableView" VBox.vgrow="ALWAYS" .../>  <!-- chiếm hết phần cao còn lại -->
```

- `HBox.hgrow="ALWAYS"` — khi `HBox` cha có thêm không gian ngang (ví dụ resize cửa sổ — nhưng app
  này `setResizable(false)` nên chủ yếu áp dụng khi layout có khoảng trống dư), `TextField` này sẽ
  **giãn ra** chiếm hết, các Node khác (Label) giữ kích thước cố định (`prefWidth="160"`).
- Đây là cách JavaFX làm "responsive" cơ bản — không cần tính toán pixel thủ công.

---

## 6. Event Handling — `onAction="#method"`

```xml
<Button text="Dang Nhap" onAction="#handleLogin" defaultButton="true"/>
```

```java
@FXML
private void handleLogin() throws IOException { ... }
```

- `onAction="#handleLogin"` — khi user **click** button này (hoặc nhấn Enter nếu
  `defaultButton="true"`), JavaFX gọi `handleLogin()` trên controller.
- Method phải có `@FXML`, thường `private`, và có thể: không tham số, hoặc 1 tham số kiểu
  `ActionEvent` (project này không dùng tham số — không cần thông tin về event).
- `defaultButton="true"` — đánh dấu "đây là nút mặc định" — khi user nhấn **Enter** ở bất kỳ field
  nào trong Scene, button này được "click" — UX quen thuộc (form login: gõ password rồi Enter).

### Tham Số Hóa Hành Vi Qua FXML — Không Cần `if/else` Theo Nút Nào Được Bấm

So sánh: nếu **không** dùng `onAction="#method"` riêng cho từng nút, bạn phải:
```java
// CÁCH CỒNG KỀNH — 1 handler chung, if/else theo nguồn gốc event
public void handleClick(ActionEvent e) {
    if (e.getSource() == btnLogin) { ... }
    else if (e.getSource() == btnRegister) { ... }
    ...
}
```
Với `onAction="#handleLogin"` / `onAction="#goRegister"` riêng biệt, **mỗi nút có method riêng,
ngắn gọn, rõ ràng** — không cần if/else phân loại.

---

## 7. Properties — `SimpleStringProperty`, `SimpleIntegerProperty`, `ObservableList`

`TableView` trong JavaFX **không hiển thị trực tiếp `List<Task>`** — nó cần dữ liệu dưới dạng
**`ObservableList`** (danh sách "có thể quan sát" — khi danh sách thay đổi, `TableView` tự vẽ lại),
và mỗi cột (`TableColumn`) cần biết **lấy giá trị nào** từ mỗi `Task` để hiển thị.

```java
@FXML private TableColumn<Task, String> colId;
@FXML private TableColumn<Task, String> colTitle;

private void setupColumns() {
    colId.setCellValueFactory(d -> new SimpleStringProperty(d.getValue().id));
    colTitle.setCellValueFactory(d -> new SimpleStringProperty(d.getValue().title));
}

private void loadData(List<Task> data) {
    tableView.setItems(FXCollections.observableArrayList(data));
}
```

- `TableColumn<Task, String>` — generic 2 tham số: "dữ liệu của 1 HÀNG là `Task`", "dữ liệu HIỂN THỊ
  TRONG CỘT NÀY là `String`".
- `setCellValueFactory(d -> ...)` — `d` là 1 `CellDataFeatures` đại diện cho **1 hàng** (truy cập
  object `Task` qua `d.getValue()`). Lambda phải trả về một **`ObservableValue<String>`** —
  `new SimpleStringProperty(d.getValue().id)` "bọc" giá trị `String` (`task.id`) thành property mà
  `TableView` hiểu được.
- `FXCollections.observableArrayList(data)` — chuyển `List<Task>` thường thành `ObservableList<Task>`
  — `TableView.setItems(...)` chỉ nhận `ObservableList`.

> **Tại sao cần "Observable"?** Nếu sau này bạn `tasks.add(newTask)` vào 1 `ObservableList`,
> `TableView` **tự động** hiển thị thêm 1 hàng — không cần gọi `refresh()` thủ công. (Trong
> project này, `loadData()` luôn tạo `ObservableList` MỚI mỗi lần — cách đơn giản, dễ hiểu, dù
> không tận dụng hết khả năng "tự cập nhật" của Observable.)

### `CellFactory` — Tùy Biến HIỂN THỊ (Không Phải Dữ Liệu)

```java
colPriority.setCellValueFactory(d -> new SimpleStringProperty(d.getValue().priority));  // DỮ LIỆU: "HIGH"/"MEDIUM"/"LOW"
colPriority.setCellFactory(col -> new TableCell<>() {                                    // HIỂN THỊ: thêm màu
    @Override
    protected void updateItem(String item, boolean empty) {
        super.updateItem(item, empty);
        if (empty || item == null) { setText(null); setStyle(""); return; }
        setText(item);
        String color = switch (item) {
            case "HIGH"   -> "#F38BA8";
            case "MEDIUM" -> "#FAB387";
            default       -> "#A6E3A1";
        };
        setStyle("-fx-text-fill: " + color + "; -fx-font-weight: bold;");
    }
});
```

Phân tách 2 trách nhiệm:
- **`setCellValueFactory`** — "ô này hiển thị **GIÁ TRỊ GÌ**?" → trả về `"HIGH"`.
- **`setCellFactory`** — "ô này **TRÔNG NHƯ THẾ NÀO**?" → custom `TableCell`, override
  `updateItem()` để set màu chữ dựa vào giá trị.

`updateItem(item, empty)` được JavaFX gọi **mỗi khi cell cần vẽ lại** (khi data đổi, khi scroll
TableView làm cell "tái sử dụng" cho hàng khác...). `empty` = `true` khi cell này **không có dữ
liệu** (ví dụ TableView có nhiều dòng trống hơn số task) — luôn phải xử lý case này
(`if (empty || item == null) { setText(null); setStyle(""); return; }`) để tránh hiển thị "rác" ở
các dòng trống.

---

## 8. CSS Trong JavaFX — `styleClass` + `main.css`

```xml
<Button text="Dang Nhap" styleClass="btn-primary" .../>
```

```css
.btn-primary {
  -fx-background-color: #89b4fa;
  -fx-text-fill: #1e1e2e;
  -fx-font-weight: bold;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
  -fx-padding: 9 18;
  -fx-cursor: hand;
}
.btn-primary:hover   { -fx-background-color: #b4befe; }
.btn-primary:pressed { -fx-background-color: #7287fd; }
```

- JavaFX CSS **giống CSS web** nhưng property bắt đầu bằng `-fx-` (ví dụ `-fx-background-color`
  thay vì `background-color`).
- `styleClass="btn-primary"` ↔ `.btn-primary { ... }` — giống `class="btn-primary"` trong HTML ↔
  `.btn-primary { }` trong CSS web.
- `:hover`, `:pressed`, `:selected`, `:focused` — **pseudo-class**, áp dụng style khi Node ở trạng
  thái đó (chuột đang hover, đang được bấm, đang được chọn, đang có focus...).
- `stylesheets="@../styles/main.css"` (trong FXML root) — áp dụng file CSS này cho **toàn bộ Scene**
  — mọi Node con đều có thể dùng các class định nghĩa trong đó.

### `setVisible(false)` vs `setManaged(false)` — Ẩn Nút Theo Quyền (Role-Based UI)

```java
btnManageUsers.setVisible(UserSession.isAdmin());
btnManageUsers.setManaged(UserSession.isAdmin());
```

- `setVisible(false)` — Node **không hiển thị** (vô hình), nhưng **VẪN CHIẾM KHÔNG GIAN** trong
  layout (giống `visibility: hidden` trong CSS web) → để lại "khoảng trống" kỳ lạ trong `VBox`
  sidebar.
- `setManaged(false)` — Node **bị loại khỏi tính toán layout hoàn toàn** (giống
  `display: none` trong CSS web) → các Node khác trong `VBox` "lấp đầy" khoảng trống đó.

→ Cần gọi **CẢ HAI** để: user thường **không thấy** nút "Quan Ly Users" VÀ **không có khoảng trống
trống** ở vị trí đó trong sidebar. Đây là cách JavaFX triển khai **ẩn UI theo role** — kết hợp với
`UserSession.isAdmin()` (`KienThuc_02`).

---

## 9. Tổng Kết — "Vòng Đời" Một Màn Hình JavaFX

```
1. SceneSwitcher.switchScene("task_list.fxml")
2.   → FXMLLoader đọc task_list.fxml
3.       → tạo new TaskListController()                      (constructor — fields @FXML CHƯA có giá trị)
4.       → gán các Node (tableView, colId, btnDelete...) vào field @FXML tương ứng
5.       → đăng ký onAction="#handleFilter" → handleFilter(), v.v.
6.       → gọi initialize(url, rb)                            (fields @FXML ĐÃ có giá trị)
7.           → setupColumns(): cellValueFactory + cellFactory cho mỗi TableColumn
8.           → setupFilters(): đổ data vào ComboBox
9.           → btnDelete.setVisible/setManaged(UserSession.isAdmin())
10.          → loadData(service.getAll()): tableView.setItems(FXCollections.observableArrayList(...))
11.  → stage.setScene(new Scene(rootNode))                    ← màn hình hiển thị ra
12. User click "Loc" → handleFilter() chạy → loadData(filtered) → TableView vẽ lại
```

---

**Tiếp theo:** `ProjectManagerApp_KienThuc_08_ModernJava_Algorithm_Security.md` — `switch`
expression (Java 14+), thuật toán Two Pointer, kiểm tra trùng lặp (LeetCode #217), và vì sao
password được hash bằng SHA-256.
