# ProjectManagerApp — Hướng Dẫn 06: FXML & CSS

**Vị trí:** `src/com/projectmanager/ui/views/*.fxml` · `src/com/projectmanager/ui/styles/main.css`

> **Lưu ý đường dẫn:**
> - Trong FXML: `stylesheets="@../styles/main.css"` → tương đối từ thư mục `views/`
> - Trong SceneSwitcher: `App.class.getResource("/com/projectmanager/ui/views/" + fxml)` → classpath root

---

## login.fxml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?import javafx.scene.layout.*?>
<?import javafx.scene.control.*?>
<?import javafx.geometry.*?>

<AnchorPane prefHeight="500.0" prefWidth="400.0"
            xmlns:fx="http://javafx.com/fxml/1"
            fx:controller="com.projectmanager.ui.controllers.LoginController"
            stylesheets="@../styles/main.css">

    <VBox alignment="CENTER" spacing="16"
          AnchorPane.leftAnchor="60" AnchorPane.rightAnchor="60"
          AnchorPane.topAnchor="70"  AnchorPane.bottomAnchor="70">

        <Label text="Project Manager" styleClass="title"/>
        <Label text="Dang Nhap"       styleClass="subtitle"/>

        <VBox spacing="4">
            <Label text="Username" styleClass="field-label"/>
            <TextField fx:id="txtUsername" promptText="Nhap username" styleClass="field"/>
        </VBox>

        <VBox spacing="4">
            <Label text="Mat Khau" styleClass="field-label"/>
            <PasswordField fx:id="txtPassword" promptText="Nhap mat khau" styleClass="field"/>
        </VBox>

        <Button text="Dang Nhap" onAction="#handleLogin"
                styleClass="btn-primary" maxWidth="Infinity" defaultButton="true"/>

        <Label fx:id="lblMessage" wrapText="true" alignment="CENTER" maxWidth="Infinity"/>

        <Separator opacity="0.3"/>

        <Button text="Tao Tai Khoan Moi" onAction="#goRegister"
                styleClass="btn-secondary" maxWidth="Infinity"/>
    </VBox>
</AnchorPane>
```

---

## register.fxml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?import javafx.scene.layout.*?>
<?import javafx.scene.control.*?>
<?import javafx.geometry.*?>

<AnchorPane prefHeight="600.0" prefWidth="400.0"
            xmlns:fx="http://javafx.com/fxml/1"
            fx:controller="com.projectmanager.ui.controllers.RegisterController"
            stylesheets="@../styles/main.css">

    <VBox alignment="CENTER" spacing="12"
          AnchorPane.leftAnchor="60" AnchorPane.rightAnchor="60"
          AnchorPane.topAnchor="50"  AnchorPane.bottomAnchor="50">

        <Label text="Project Manager" styleClass="title"/>
        <Label text="Tao Tai Khoan"   styleClass="subtitle"/>

        <VBox spacing="4">
            <Label text="Username (it nhat 3 ky tu)" styleClass="field-label"/>
            <TextField fx:id="txtUsername" promptText="username" styleClass="field"/>
        </VBox>

        <VBox spacing="4">
            <Label text="Mat Khau (it nhat 6 ky tu)" styleClass="field-label"/>
            <PasswordField fx:id="txtPassword" promptText="mat khau" styleClass="field"/>
        </VBox>

        <VBox spacing="4">
            <Label text="Xac Nhan Mat Khau" styleClass="field-label"/>
            <PasswordField fx:id="txtConfirm" promptText="nhap lai mat khau" styleClass="field"/>
        </VBox>

        <VBox spacing="4">
            <Label text="Email (khong bat buoc)" styleClass="field-label"/>
            <TextField fx:id="txtEmail" promptText="email@example.com" styleClass="field"/>
        </VBox>

        <VBox spacing="4">
            <Label text="Role" styleClass="field-label"/>
            <ComboBox fx:id="cbRole" maxWidth="Infinity" styleClass="field"/>
        </VBox>

        <Button text="Dang Ky" onAction="#handleRegister"
                styleClass="btn-primary" maxWidth="Infinity" defaultButton="true"/>

        <Label fx:id="lblMessage" wrapText="true" alignment="CENTER" maxWidth="Infinity"/>

        <Separator opacity="0.3"/>

        <Button text="Quay Ve Dang Nhap" onAction="#goLogin"
                styleClass="btn-secondary" maxWidth="Infinity"/>
    </VBox>
</AnchorPane>
```

---

## dashboard.fxml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?import javafx.scene.layout.*?>
<?import javafx.scene.control.*?>
<?import javafx.geometry.*?>

<BorderPane prefHeight="520.0" prefWidth="720.0"
            xmlns:fx="http://javafx.com/fxml/1"
            fx:controller="com.projectmanager.ui.controllers.DashboardController"
            stylesheets="@../styles/main.css">

    <!-- TOP: Header với welcome + logout -->
    <top>
        <HBox alignment="CENTER_LEFT" spacing="16" styleClass="header">
            <Label text="Project Manager" styleClass="title"/>
            <Region HBox.hgrow="ALWAYS"/>
            <VBox alignment="CENTER_RIGHT" spacing="2">
                <Label fx:id="lblWelcome" styleClass="subtitle"/>
                <Label fx:id="lblRole"    styleClass="field-label"/>
            </VBox>
            <Button text="Dang Xuat" onAction="#handleLogout" styleClass="btn-danger"/>
        </HBox>
    </top>

    <!-- LEFT: Sidebar điều hướng -->
    <left>
        <VBox spacing="8" styleClass="sidebar" prefWidth="200">
            <padding><Insets top="20" bottom="20" left="12" right="12"/></padding>
            <Label text="Dieu Huong" styleClass="field-label"/>
            <Separator opacity="0.3"/>
            <Button text="Them Task"      onAction="#goAddTask"     styleClass="sidebar-btn" maxWidth="Infinity"/>
            <Button text="Danh Sach Task" onAction="#goTaskList"    styleClass="sidebar-btn" maxWidth="Infinity"/>
            <Separator opacity="0.3"/>
            <!-- btnManageUsers: ẩn với user thường (setVisible/setManaged = false trong Controller) -->
            <Button fx:id="btnManageUsers" text="Quan Ly Users"
                    onAction="#goManageUsers" styleClass="sidebar-btn-admin" maxWidth="Infinity"/>
        </VBox>
    </left>

    <!-- CENTER: Thống kê tổng quan -->
    <center>
        <VBox alignment="CENTER" spacing="24">
            <padding><Insets top="40" left="40" right="40"/></padding>
            <Label text="Tong Quan Du An" styleClass="title"/>
            <Label fx:id="lblStats" styleClass="stats-label" wrapText="true"
                   alignment="CENTER" maxWidth="400"/>
            <Label text="Chon menu ben trai de bat dau."
                   styleClass="field-label" wrapText="true"/>
        </VBox>
    </center>
</BorderPane>
```

---

## add_task.fxml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?import javafx.scene.layout.*?>
<?import javafx.scene.control.*?>
<?import javafx.geometry.*?>

<BorderPane prefHeight="620.0" prefWidth="720.0"
            xmlns:fx="http://javafx.com/fxml/1"
            fx:controller="com.projectmanager.ui.controllers.AddTaskController"
            stylesheets="@../styles/main.css">

    <top>
        <HBox alignment="CENTER_LEFT" spacing="12" styleClass="header">
            <Button text="← Quay Lai" onAction="#goBack" styleClass="btn-secondary"/>
            <Label text="Them Task Moi" styleClass="title"/>
        </HBox>
    </top>

    <center>
        <ScrollPane fitToWidth="true" styleClass="scroll-pane">
            <VBox spacing="16" styleClass="form-container">
                <padding><Insets top="24" bottom="24" left="40" right="40"/></padding>

                <!-- Chọn loại task -->
                <HBox alignment="CENTER_LEFT" spacing="16">
                    <Label text="Loai Task" styleClass="field-label" prefWidth="160"/>
                    <HBox spacing="8">
                        <ToggleButton fx:id="btnBug"     text="Bug"     styleClass="toggle-btn"/>
                        <ToggleButton fx:id="btnFeature" text="Feature" styleClass="toggle-btn"/>
                    </HBox>
                </HBox>

                <!-- Task ID -->
                <HBox alignment="CENTER_LEFT" spacing="16">
                    <Label text="Task ID (VD: B001)" styleClass="field-label" prefWidth="160"/>
                    <TextField fx:id="txtId" promptText="B001 hoac F001" styleClass="field" HBox.hgrow="ALWAYS"/>
                </HBox>

                <!-- Tiêu đề -->
                <HBox alignment="CENTER_LEFT" spacing="16">
                    <Label text="Tieu De" styleClass="field-label" prefWidth="160"/>
                    <TextField fx:id="txtTitle" promptText="Mo ta ngan gon" styleClass="field" HBox.hgrow="ALWAYS"/>
                </HBox>

                <!-- Priority -->
                <HBox alignment="CENTER_LEFT" spacing="16">
                    <Label text="Do Uu Tien" styleClass="field-label" prefWidth="160"/>
                    <ComboBox fx:id="cbPriority" maxWidth="Infinity" styleClass="field" HBox.hgrow="ALWAYS"/>
                </HBox>

                <!-- Status -->
                <HBox alignment="CENTER_LEFT" spacing="16">
                    <Label text="Trang Thai" styleClass="field-label" prefWidth="160"/>
                    <ComboBox fx:id="cbStatus" maxWidth="Infinity" styleClass="field" HBox.hgrow="ALWAYS"/>
                </HBox>

                <!-- Bug: Severity (ẩn khi chọn Feature) -->
                <HBox fx:id="rowSeverity" alignment="CENTER_LEFT" spacing="16">
                    <Label text="Severity (Bug)" styleClass="field-label" prefWidth="160"/>
                    <ComboBox fx:id="cbSeverity" maxWidth="Infinity" styleClass="field" HBox.hgrow="ALWAYS"/>
                </HBox>

                <!-- Feature: Estimated Hours (ẩn khi chọn Bug) -->
                <HBox fx:id="rowHours" alignment="CENTER_LEFT" spacing="16">
                    <Label text="So Gio Uoc Tinh" styleClass="field-label" prefWidth="160"/>
                    <TextField fx:id="txtHours" promptText="VD: 8" styleClass="field" HBox.hgrow="ALWAYS"/>
                </HBox>

                <!-- Feature: Developer (ẩn khi chọn Bug) -->
                <HBox fx:id="rowDeveloper" alignment="CENTER_LEFT" spacing="16">
                    <Label text="Giao Cho Developer" styleClass="field-label" prefWidth="160"/>
                    <TextField fx:id="txtDeveloper" promptText="Ten developer (co the bo trong)"
                               styleClass="field" HBox.hgrow="ALWAYS"/>
                </HBox>

                <Separator opacity="0.3"/>

                <Button text="Them Task" onAction="#handleAdd"
                        styleClass="btn-primary" maxWidth="Infinity" defaultButton="true"/>

                <Label fx:id="lblMessage" wrapText="true" alignment="CENTER" maxWidth="Infinity"/>
            </VBox>
        </ScrollPane>
    </center>
</BorderPane>
```

---

## task_list.fxml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?import javafx.scene.layout.*?>
<?import javafx.scene.control.*?>
<?import javafx.geometry.*?>

<BorderPane prefHeight="700.0" prefWidth="1050.0"
            xmlns:fx="http://javafx.com/fxml/1"
            fx:controller="com.projectmanager.ui.controllers.TaskListController"
            stylesheets="@../styles/main.css">

    <top>
        <HBox alignment="CENTER_LEFT" spacing="12" styleClass="header">
            <Button text="← Quay Lai" onAction="#goBack" styleClass="btn-secondary"/>
            <Label text="Danh Sach Task" styleClass="title"/>
        </HBox>
    </top>

    <center>
        <VBox spacing="12">
            <padding><Insets top="16" bottom="16" left="20" right="20"/></padding>

            <!-- Toolbar: Filter + Update status + Delete -->
            <HBox spacing="8" alignment="CENTER_LEFT">
                <Label text="Status:" styleClass="field-label"/>
                <ComboBox fx:id="cbFilterStatus" styleClass="field" prefWidth="130"/>
                <Label text="Loai:" styleClass="field-label"/>
                <ComboBox fx:id="cbFilterType" styleClass="field" prefWidth="100"/>
                <Button text="Loc"          onAction="#handleFilter"      styleClass="btn-primary"/>
                <Button text="Xoa Loc"      onAction="#handleClearFilter" styleClass="btn-secondary"/>
                <Region HBox.hgrow="ALWAYS"/>
                <Label text="Doi Status:" styleClass="field-label"/>
                <ComboBox fx:id="cbNewStatus" styleClass="field" prefWidth="130"/>
                <Button text="Cap Nhat"     onAction="#handleUpdateStatus" styleClass="btn-secondary"/>
                <!-- btnDelete: ẩn với user thường, hiện với admin (set trong Controller) -->
                <Button fx:id="btnDelete" text="Xoa Task" onAction="#handleDelete" styleClass="btn-danger"/>
                <Button text="Tai Lai DB"   onAction="#handleReload"      styleClass="btn-secondary"/>
            </HBox>

            <!-- TableView -->
            <TableView fx:id="tableView" VBox.vgrow="ALWAYS" styleClass="table-view">
                <columns>
                    <TableColumn fx:id="colType"     text="Loai"     prefWidth="60"/>
                    <TableColumn fx:id="colId"       text="ID"       prefWidth="80"/>
                    <TableColumn fx:id="colTitle"    text="Tieu De"  prefWidth="260"/>
                    <TableColumn fx:id="colPriority" text="Priority" prefWidth="90"/>
                    <TableColumn fx:id="colStatus"   text="Status"   prefWidth="120"/>
                    <TableColumn fx:id="colEffort"   text="Effort"   prefWidth="75"/>
                    <TableColumn fx:id="colExtra"    text="Severity / Developer" prefWidth="200"/>
                </columns>
                <placeholder>
                    <Label text="Khong co task nao." styleClass="field-label"/>
                </placeholder>
            </TableView>

            <!-- Stats bar -->
            <HBox spacing="40" alignment="CENTER_LEFT">
                <Label fx:id="lblEffort" styleClass="subtitle"/>
                <Label fx:id="lblStatus" styleClass="field-label"/>
            </HBox>
        </VBox>
    </center>
</BorderPane>
```

---

## user_list.fxml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?import javafx.scene.layout.*?>
<?import javafx.scene.control.*?>
<?import javafx.geometry.*?>

<BorderPane prefHeight="580.0" prefWidth="750.0"
            xmlns:fx="http://javafx.com/fxml/1"
            fx:controller="com.projectmanager.ui.controllers.UserListController"
            stylesheets="@../styles/main.css">

    <top>
        <HBox alignment="CENTER_LEFT" spacing="12" styleClass="header">
            <Button text="← Quay Lai" onAction="#goBack" styleClass="btn-secondary"/>
            <Label text="Quan Ly Users (Admin)" styleClass="title"/>
            <Region HBox.hgrow="ALWAYS"/>
            <Label text="[ADMIN ONLY]" styleClass="tag-admin"/>
        </HBox>
    </top>

    <center>
        <VBox spacing="12">
            <padding><Insets top="16" bottom="16" left="20" right="20"/></padding>

            <!-- Toolbar -->
            <HBox spacing="8" alignment="CENTER_LEFT">
                <Button text="Khoa / Mo Khoa" onAction="#handleToggleStatus" styleClass="btn-warning"/>
                <Button text="Lam Moi"         onAction="#handleRefresh"      styleClass="btn-secondary"/>
                <Region HBox.hgrow="ALWAYS"/>
                <Label fx:id="lblMessage" styleClass="field-label"/>
            </HBox>

            <!-- TableView -->
            <TableView fx:id="tableView" VBox.vgrow="ALWAYS" styleClass="table-view">
                <columns>
                    <TableColumn fx:id="colId"       text="ID"       prefWidth="60"/>
                    <TableColumn fx:id="colUsername"  text="Username" prefWidth="150"/>
                    <TableColumn fx:id="colEmail"     text="Email"    prefWidth="220"/>
                    <TableColumn fx:id="colRole"      text="Role"     prefWidth="90"/>
                    <TableColumn fx:id="colStatus"    text="Trang Thai" prefWidth="100"/>
                </columns>
                <placeholder>
                    <Label text="Khong co user nao." styleClass="field-label"/>
                </placeholder>
            </TableView>
        </VBox>
    </center>
</BorderPane>
```

---

## main.css

```css
/* ── Root ──────────────────────────────────────────────────── */

.root {
  -fx-background-color: #1e1e2e;
  -fx-font-family: Georgia, serif;
  -fx-font-size: 13px;
}

/* ── Typography ─────────────────────────────────────────────── */

.title {
  -fx-text-fill: #cdd6f4;
  -fx-font-size: 22px;
  -fx-font-weight: bold;
}

.subtitle {
  -fx-text-fill: #a6adc8;
  -fx-font-size: 13px;
}

.field-label {
  -fx-text-fill: #6c7086;
  -fx-font-size: 11px;
}

.stats-label {
  -fx-text-fill: #cdd6f4;
  -fx-font-size: 14px;
  -fx-line-spacing: 4;
}

.label {
  -fx-text-fill: #cdd6f4;
}

/* ── Form Fields ─────────────────────────────────────────────── */

.field {
  -fx-background-color: #313244;
  -fx-text-fill: #cdd6f4;
  -fx-prompt-text-fill: #585b70;
  -fx-border-color: #45475a;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
  -fx-padding: 8 12;
}

.field:focused {
  -fx-border-color: #89b4fa;
  -fx-background-color: #363649;
}

/* ── Buttons ─────────────────────────────────────────────────── */

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

.btn-secondary {
  -fx-background-color: transparent;
  -fx-text-fill: #89b4fa;
  -fx-border-color: #45475a;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
  -fx-padding: 9 18;
  -fx-cursor: hand;
}
.btn-secondary:hover { -fx-background-color: #313244; -fx-border-color: #89b4fa; }

.btn-danger {
  -fx-background-color: #f38ba8;
  -fx-text-fill: #1e1e2e;
  -fx-font-weight: bold;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
  -fx-padding: 9 18;
  -fx-cursor: hand;
}
.btn-danger:hover { -fx-background-color: #eba0ac; }

/* Nút vàng — dùng cho block/unblock user (nguy hiểm nhưng không destructive như xóa) */
.btn-warning {
  -fx-background-color: #fab387;
  -fx-text-fill: #1e1e2e;
  -fx-font-weight: bold;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
  -fx-padding: 9 18;
  -fx-cursor: hand;
}
.btn-warning:hover { -fx-background-color: #f9e2af; }

/* ── Toggle Buttons ──────────────────────────────────────────── */

.toggle-btn {
  -fx-background-color: #313244;
  -fx-text-fill: #a6adc8;
  -fx-border-color: #45475a;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
  -fx-padding: 8 24;
  -fx-cursor: hand;
}
.toggle-btn:selected {
  -fx-background-color: #89b4fa;
  -fx-text-fill: #1e1e2e;
  -fx-font-weight: bold;
  -fx-border-color: #89b4fa;
}

/* ── Layout ──────────────────────────────────────────────────── */

.header {
  -fx-background-color: #181825;
  -fx-padding: 12 20;
  -fx-border-color: #45475a;
  -fx-border-width: 0 0 1 0;
}

.sidebar {
  -fx-background-color: #181825;
  -fx-padding: 20 12;
  -fx-border-color: #45475a;
  -fx-border-width: 0 1 0 0;
}

.sidebar-btn {
  -fx-background-color: transparent;
  -fx-text-fill: #a6adc8;
  -fx-alignment: CENTER_LEFT;
  -fx-padding: 10 16;
  -fx-cursor: hand;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
}
.sidebar-btn:hover { -fx-background-color: #313244; -fx-text-fill: #cdd6f4; }

/* Sidebar button admin — màu vàng cam để phân biệt */
.sidebar-btn-admin {
  -fx-background-color: transparent;
  -fx-text-fill: #fab387;
  -fx-alignment: CENTER_LEFT;
  -fx-padding: 10 16;
  -fx-cursor: hand;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
}
.sidebar-btn-admin:hover { -fx-background-color: #313244; -fx-text-fill: #f9e2af; }

.form-container  { -fx-background-color: #1e1e2e; }
.scroll-pane     { -fx-background-color: #1e1e2e; -fx-border-color: transparent; }
.scroll-pane > .viewport { -fx-background-color: #1e1e2e; }

/* Tag "ADMIN ONLY" trong header user_list */
.tag-admin {
  -fx-text-fill: #f38ba8;
  -fx-font-size: 11px;
  -fx-font-weight: bold;
  -fx-background-color: #3b1f2b;
  -fx-padding: 3 8;
  -fx-background-radius: 4;
}

/* ── TableView ───────────────────────────────────────────────── */

.table-view {
  -fx-background-color: #313244;
  -fx-border-color: #45475a;
  -fx-border-radius: 5;
  -fx-table-cell-border-color: #45475a;
}
.table-view .column-header-background { -fx-background-color: #45475a; }
.table-view .column-header .label {
  -fx-text-fill: #cdd6f4;
  -fx-font-weight: bold;
  -fx-font-size: 12px;
}
.table-view .table-row-cell {
  -fx-background-color: #313244;
  -fx-border-color: #45475a;
  -fx-border-width: 0 0 1 0;
}
.table-view .table-row-cell:selected { -fx-background-color: #45475a; }
.table-view .table-row-cell:hover    { -fx-background-color: #363649; }
.table-view .table-cell {
  -fx-text-fill: #cdd6f4;
  -fx-font-size: 12px;
  -fx-padding: 6 8;
}

/* ── Separator & ComboBox ────────────────────────────────────── */

.separator .line { -fx-border-color: #45475a; -fx-border-width: 1 0 0 0; }

.combo-box {
  -fx-background-color: #313244;
  -fx-text-fill: #cdd6f4;
  -fx-border-color: #45475a;
  -fx-border-radius: 5;
  -fx-background-radius: 5;
}
.combo-box .list-cell        { -fx-text-fill: #cdd6f4; -fx-background-color: #313244; }
.combo-box-popup .list-view  { -fx-background-color: #313244; -fx-border-color: #45475a; }
.combo-box-popup .list-view .list-cell:hover { -fx-background-color: #45475a; }
```

---

## Ghi Chú FXML & CSS

| Điểm                                        | Giải thích                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `stylesheets="@../styles/main.css"`         | `@` prefix = đường dẫn tương đối — từ `views/` lên `ui/` rồi vào `styles/`             |
| `fx:controller="com.projectmanager..."`     | JavaFX tự inject `@FXML` fields từ controller class                                     |
| `defaultButton="true"`                      | Enter phím phản hồi nút Login/Đăng ký                                                   |
| `HBox.hgrow="ALWAYS"`                       | TextField co giãn chiếm hết không gian ngang còn lại trong HBox                         |
| `VBox.vgrow="ALWAYS"`                       | TableView co giãn chiếm hết chiều cao trong VBox                                        |
| `prefWidth="160"` trên Label form           | Căn chỉnh cột label — mọi field cùng vị trí ngang                                      |
| `fx:id="btnManageUsers"` với setManaged     | Controller gọi `setManaged(false)` khi ẩn — nút không chiếm chỗ trong VBox layout      |
| `tag-admin` CSS class                       | Label "[ADMIN ONLY]" trong user_list — dùng `background-color` + `border-radius` để bo |
| `btn-warning` màu cam                       | Phân biệt với `btn-danger` đỏ — block user nguy hiểm hơn thao tác thường nhưng ít hơn xóa |
| Dark theme `#1E1E2E`                        | Background chính — Catppuccin Mocha palette                                             |
| `#F38BA8` Bug / `#89DCEB` Feature          | Màu đỏ hồng (Bug) và teal (Feature) trong TableView cột Type                            |
| `#F38BA8`/`#FAB387`/`#A6E3A1` Priority     | Đỏ (HIGH), Cam (MEDIUM), Xanh lá (LOW)                                                  |
| `sidebar-btn-admin` cam nhạt               | Phân biệt nút admin với nút thường trong sidebar — dễ nhận ra quyền hạn                 |
