# 📘 HƯỚNG DẪN CHI TIẾT TRIỂN KHAI FRONTEND (REACT VITE)
**Dự án:** WorkTracker Pro (Django REST Framework + React Vite)  
**Tài liệu:** Frontend Implementation Master Guide  
**Ngày lập:** 24/07/2026  

---

## 🎯 1. TỔNG QUAN & QUY TẮC CÔNG NGHỆ (CORE PRINCIPLES)

1. **Kiến trúc:** Single Page Application (SPA) xây dựng trên nền **React (Vite)** kết nối với Backend **Django REST Framework** qua REST API và WebSockets (`ws/notifications/`).
2. **Quy tắc ngôn ngữ:** **Sử dụng 100% thuần JavaScript (`.js` cho các file logic/service/store/utils và `.jsx` cho các file React Components)**. Không sử dụng TypeScript (`.ts`/`.tsx`).
3. **Thiết kế Giao diện (Design System):** Thống nhất 100% về giao diện giữa 3 phân hệ (**Admin**, **Manager**, **Employee**), sử dụng màu nền Slate Dark (`#0F172A`) cho Sidebar và tông màu xám sáng nhã nhặn cho nội dung chính.

### 📌 Trạng thái Thiết kế Giao diện Phân hệ Manager (12 Trang Nâng Cấp):

| Thứ tự | Trang Manager | Luồng truy cập & Lý do | Trạng thái Thiết kế |
| :---: | :--- | :--- | :---: |
| **1** | **Dashboard** | Trang tổng quan chính của Manager | ✅ **Đã chốt** (Có ảnh) |
| **2** | **My Jobs (Job List)** | Trung tâm điều hướng dự án của Manager | ✅ **Đã chốt** (Có ảnh) |
| **3** | **Job Detail** | Mở từ danh sách Job List | ✅ **Đã chốt** (Có ảnh) |
| **4** | **Kanban Board** | Mở từ trang Job Detail | ⏳ Đang thiết kế |
| **5** | **Task Detail Drawer/Page** | Mở từ bảng Kanban Board | ⏳ Đang thiết kế |
| **6** | **Team Members** | Xem danh sách nhân sự của Job | ⏳ Đang thiết kế |
| **7** | **Timesheet Review** | Duyệt nhật ký giờ làm việc | ⏳ Đang thiết kế |
| **8** | **Time Lock** | Khóa kỳ công chốt sổ | ⏳ Đang thiết kế |
| **9** | **Reports** | Báo cáo & Trích xuất file | ⏳ Đang thiết kế |
| **10** | **Notifications** | Trung tâm thông báo | ⏳ Đang thiết kế |
| **11** | **Profile** | Hồ sơ cá nhân | ⏳ Đang thiết kế |
| **12** | **Settings** | Cài đặt hệ thống | ⏳ Đang thiết kế |

---

## 📦 2. THỐNG KÊ THƯ VIỆN NPM CẦN DÙNG (PACKAGE INVENTORY)

Dưới đây là danh sách đầy đủ tất cả các thư viện NPM cần cài đặt cho dự án:

| Nhóm chức năng | Thư viện (NPM Package) | Vai trò & Mục đích sử dụng |
| :--- | :--- | :--- |
| **Lõi App & Routing** | `react-router-dom` | Định tuyến trang SPA và điều hướng Protected Route Guards theo Role |
| **Quản lý State** | `zustand` | Lưu Global Auth Token, User Info, Notification Badge, Sidebar Collapse State |
| **Data Fetching & Cache**| `@tanstack/react-query` | Quản lý Cache API, tự động revalidate, polling dữ liệu |
| **Kết nối HTTP Client** | `axios` | Đính kèm Bearer JWT Token, tự động Refresh Token, xử lý lỗi 401/403/404 |
| **CSS & Styling** | `tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge` | Styling giao diện linh hoạt, hàm tiện ích `cn()` ghép class động |
| **Bộ Icon** | `lucide-react` | Bộ Icon chuẩn SaaS (Folder, Play, Eye, Calendar, Bell, User, Lock,...) |
| **Bảng dữ liệu (Table)** | `@tanstack/react-table` | Bảng phân trang, sắp xếp cột, lọc dữ liệu dung lượng lớn |
| **Kéo-thả Kanban** | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Kéo thả Card giữa các cột Kanban (`TODO`, `IN_PROGRESS`, `IN_REVIEW`,...) |
| **Biểu đồ Analytics** | `recharts` | Biểu đồ Donut Chart, Grouped Bar Chart, Line Chart, Productivity Heatmap Grid |
| **Xử lý Form & Validate** | `react-hook-form`, `zod`, `@hookform/resolvers` | Validate dữ liệu Form phía Client trước khi gửi API |
| **Realtime & Toast** | `react-use-websocket`, `sonner` | Kết nối WebSocket `ws/notifications/` & Toast thông báo nảy góc |
| **Thời gian & Date** | `date-fns` | Format định dạng ngày tháng (`YYYY-MM-DD`, `HH:mm`, `time ago`) |
| **Headless UI Primitives**| `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip` | Bộ linh kiện nguyên tử chuẩn Shadcn UI cho Modal, Drawer, Select |

---

## 🛠️ 3. LỆNH CÀI ĐẶT TỪNG BƯỚC (STEP-BY-STEP TERMINAL COMMANDS)

Thực hiện chạy các lệnh PowerShell dưới đây tại thư mục `frontend/`:

```powershell
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt Tailwind CSS v4
npm install -D tailwindcss @tailwindcss/vite

# 3. Cài đặt các thư viện Lõi (Routing, State, API Client, Icons)
npm install react-router-dom zustand @tanstack/react-query axios lucide-react clsx tailwind-merge date-fns

# 4. Cài đặt các thư viện Chuyên dụng (Table, Recharts, dnd-kit, WebSockets, Toast)
npm install @tanstack/react-table recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-use-websocket sonner

# 5. Cài đặt các thư viện Form & Headless UI (Radix UI)
npm install react-hook-form zod @hookform/resolvers @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip
```

---

## 📂 4. CẤU TRÚC THƯ MỤC DỰ ÁN FRONTEND (JS / JSX ARCHITECTURE)

Dưới đây là cấu trúc thư mục chuẩn được sắp xếp khoa học trong `frontend/src/`:

```text
frontend/src/
├── assets/                    # Hình ảnh, logo WorkTracker, icon tĩnh
├── components/
│   ├── common/                # 🟩 COMPONENT DÙNG CHUNG TOÀN HỆ THỐNG (3 ROLES)
│   │   ├── layout/            # Sidebar.jsx, Header.jsx, Footer.jsx
│   │   ├── cards/             # StatCard.jsx, DailyLimitProgressBar.jsx, SystemPolicyCard.jsx
│   │   ├── table/             # DataTable.jsx, PaginationBar.jsx, FilterToolbar.jsx, ViewToggle.jsx
│   │   ├── badges/            # StatusBadge.jsx, PriorityBadge.jsx, RoleBadge.jsx, SeverityBadge.jsx
│   │   ├── drawer/            # SideDrawer.jsx, AuditDiffViewer.jsx, ReportDetailDrawer.jsx
│   │   ├── charts/            # DonutChartCard.jsx, LineChartCard.jsx, HorizontalBarChartCard.jsx, ProductivityHeatmap.jsx
│   │   ├── forms/             # QuickLogWorkFormCard.jsx, InputField.jsx, SelectDropdown.jsx
│   │   ├── feeds/             # NotificationListTable.jsx, ActivityFeedTimeline.jsx
│   │   └── profile/           # AvatarUploadCard.jsx, ProfileFormCard.jsx, AccountSecurityCard.jsx
│   │
│   ├── admin/                 # 🟨 Component riêng của phân hệ Admin
│   │   └── RolePermissionsDrawer.jsx
│   ├── manager/               # 🟦 Component riêng của phân hệ Manager
│   │   ├── TaskDetailDrawer.jsx
│   │   ├── CreateJobModal.jsx
│   │   └── TimeLockModal.jsx
│   └── employee/              # 🟪 Component riêng của phân hệ Employee
│       └── EmployeeTaskCard.jsx
│
├── layouts/                   # Khung Router Layout bọc giao diện
│   ├── MainLayout.jsx
│   ├── AdminLayout.jsx
│   ├── ManagerLayout.jsx
│   └── EmployeeLayout.jsx
│
├── pages/                     # Màn hình trang chính (Pages)
│   ├── auth/                  # LoginPage.jsx, ForgotPasswordPage.jsx
│   ├── admin/                 # GlobalDashboard, Clients, Jobs, Employees, TimesheetControl, AuditLogs, Reports, Settings
│   ├── manager/               # TRANG GIAO DIỆN PHÂN HỆ MANAGER (12 TRANG)
│   │   ├── ManagerDashboardPage.jsx # ✅ Trang 1: Dashboard tổng quan
│   │   ├── ManagerJobsPage.jsx      # ✅ Trang 2: My Jobs (Job List)
│   │   ├── ManagerJobDetailPage.jsx # ✅ Trang 3: Job Detail
│   │   ├── ManagerKanbanPage.jsx    # ⏳ Trang 4: Kanban Board
│   │   ├── TaskDetailDrawer.jsx     # ⏳ Trang 5: Task Detail Drawer/Page
│   │   ├── ManagerTeamPage.jsx      # ⏳ Trang 6: Team Members
│   │   ├── ManagerTimesheetReviewPage.jsx # ⏳ Trang 7: Timesheet Review
│   │   ├── ManagerTimeLockPage.jsx  # ⏳ Trang 8: Time Lock
│   │   ├── ManagerReportsPage.jsx   # ⏳ Trang 9: Reports
│   │   ├── ManagerNotificationsPage.jsx # ⏳ Trang 10: Notifications
│   │   ├── ManagerProfilePage.jsx   # ⏳ Trang 11: Profile
│   │   └── ManagerSettingsPage.jsx  # ⏳ Trang 12: Settings
│   └── employee/              # EmployeeDashboard, MyTasks, EmployeeTimesheet, Notifications, MyPerformance, Profile
│
├── services/                  # Gọi API Backend qua Axios (.js)
│   ├── apiClient.js           # Axios instance + Interceptor (JWT + Token Revocation)
│   ├── authService.js         # Login, Refresh token, Logout
│   ├── jobService.js          # CRUD Job, Change status, List active clients
│   ├── taskService.js         # CRUD Task, Kanban Move, Transition, Comments, Uploads
│   ├── timesheetService.js    # Review LogWork (Approve/Reject/Correct/Void), TimeLock
│   ├── reportService.js       # Dashboard stats, Export XLSX/PDF
│   ├── teamService.js         # List employees, Assign department
│   └── systemService.js       # Notifications, Audit logs
│
├── store/                     # Zustand Global Stores (.js)
│   ├── useAuthStore.js        # User profile, Access/Refresh Token, Role
│   ├── useNotificationStore.js# Danh sách thông báo & đếm số tin chưa đọc
│   └── useUIStore.js          # Sidebar collapse state, Theme, Modals
│
├── hooks/                     # Custom React Hooks (.js)
│   ├── useWebSocket.js        # Hook kết nối WebSocket thời gian thực
│   ├── useDebounce.js         # Hook hoãn tìm kiếm (Debounce Search)
│   └── usePermissions.js      # Hook kiểm tra quyền nút bấm (Action-level check)
│
├── utils/                     # Tiện ích dùng chung (.js)
│   ├── cn.js                  # Tailwind class merger (clsx + twMerge)
│   ├── formatters.js          # Format tiền tệ, số giờ (2,450h), định dạng ngày
│   └── constants.js           # Job status, Task status, Priority ENUMs
│
├── App.jsx                    # Root Router & Providers
├── main.jsx                   # React Entry Point
└── index.css                  # Tailwind CSS Global Imports
```

---

## 🎨 5. DANH SÁCH COMPONENT DÙNG CHUNG (SHARED COMPONENT INVENTORY)

Dựa trên việc phân tích toàn bộ 16 bức ảnh giao diện từ cả 3 phân hệ (**Admin**, **Manager**, **Employee**), dưới đây là danh sách các Component dùng chung được đóng gói tại `src/components/common/`:

### 5.1 Khối Layout & Khung Trang
- **`Sidebar.jsx`**: Thanh điều hướng bên trái theme Dark Slate (`#0F172A`), chứa logo, danh mục menu dynamic theo Role, quick access, recent items và thẻ User profile footer.
- **`Header.jsx`**: Thanh Header phía trên chứa Breadcrumb, Ô tìm kiếm `Search (Ctrl + K)`, Quả chuông Notification Badge và Dropdown Avatar User.

### 5.2 Khối Thẻ Thống kê KPI & Tiến độ
- **`StatCard.jsx`**: Thẻ thống kê KPI dùng cho tất cả các trang Dashboard/Management (Icon màu + Tiêu đề + Con số in đậm + Chỉ số so sánh).
- **`DailyLimitProgressBar.jsx`**: Thanh tiến độ đếm số giờ làm trong ngày (VD: `6.5h / 24h`) kèm tính toán giờ còn lại và tô màu xanh/cam/đỏ.
- **`SystemPolicyCard.jsx`**: Thẻ hiển thị tóm tắt các chính sách quy định hệ thống.

### 5.3 Bảng Dữ liệu & Bộ lọc
- **`DataTable.jsx`**: Bảng dữ liệu TanStack Table Wrapper hỗ trợ sắp xếp cột, hiển thị avatar, progress bar, badges và nút thao tác `Actions`.
- **`PaginationBar.jsx`**: Thanh phân trang chân bảng (`Showing X to Y of Z results`, `Items per page`, nút điều hướng `« < 1 2 3 > »`).
- **`FilterToolbar.jsx`**: Thanh tìm kiếm từ khóa, dropdown lọc danh mục, trình chọn khoảng ngày, nút `Filter` & `Reset`.
- **`ViewToggle.jsx`**: Nút chuyển đổi chế độ xem giữa `List View` ↔ `Kanban View` ↔ `Week View` ↔ `Calendar View`.

### 5.4 Hệ thống Nhãn Badge
- **`StatusBadge.jsx`**: Hiển thị trạng thái tô màu (`Active`, `Running`, `On Hold`, `Completed`, `Pending`, `Reviewing`, `Locked`, `Overdue`, `Cancelled`).
- **`PriorityBadge.jsx`**: Nhãn mức độ ưu tiên (`Low`, `Medium`, `High`, `Urgent`).
- **`RoleBadge.jsx`**: Nhãn phân loại chức danh (`Admin`, `Manager`, `Employee`).
- **`SeverityBadge.jsx`**: Nhãn mức độ nghiêm trọng cho Audit Logs (`Critical`, `Warning`, `Normal`).

### 5.5 Khối Cửa sổ Trượt & Overlay
- **`SideDrawer.jsx`**: Cửa sổ trượt từ bên phải vào (Slide-over Panel) dùng cho Chi tiết Nhân viên, Chi tiết Task (multi-tab), Chi tiết Thông báo, Chi tiết Audit Log.
- **`AuditDiffViewer.jsx`**: Khối hiển thị bảng so sánh 2 cột `Before` và `After` cho dữ liệu snapshot trong Audit Log.
- **`ReportDetailDrawer.jsx`**: Drawer trích xuất báo cáo tích hợp các nút tải xuống `Export PDF`, `Export Excel`, `Export CSV`.

### 5.6 Khối Biểu đồ Analytics
- **`DonutChartCard.jsx`**: Biểu đồ tròn có lỗ ở giữa hiển thị tổng số ở tâm (`Task Status Summary`, `Jobs by Status`, `Clients Overview`).
- **`LineChartCard.jsx`**: Biểu đồ đường biến động theo thời gian (`Logged Hours Trend`, `Total Work Hours`).
- **`HorizontalBarChartCard.jsx`**: Biểu đồ cột nằm ngang (`Hours by Project`).
- **`ProductivityHeatmap.jsx`**: Ma trận biểu đồ nhiệt giờ làm việc của nhân viên theo các ngày trong tháng.

---

## 📋 6. MA TRẬN TÁI SỬ DỤNG COMPONENT (REUSE MATRIX)

| Component (.jsx) | Admin Portal | Manager Portal | Employee Portal | Vị trí File trong Code |
| :--- | :---: | :---: | :---: | :--- |
| **`Sidebar`** | ✅ | ✅ | ✅ | `src/components/common/layout/Sidebar.jsx` |
| **`Header`** | ✅ | ✅ | ✅ | `src/components/common/layout/Header.jsx` |
| **`StatCard`** | ✅ | ✅ | ✅ | `src/components/common/cards/StatCard.jsx` |
| **`DailyLimitProgressBar`**| ❌ | ✅ | ✅ | `src/components/common/cards/DailyLimitProgressBar.jsx` |
| **`DataTable`** | ✅ | ✅ | ✅ | `src/components/common/table/DataTable.jsx` |
| **`PaginationBar`** | ✅ | ✅ | ✅ | `src/components/common/table/PaginationBar.jsx` |
| **`FilterToolbar`** | ✅ | ✅ | ✅ | `src/components/common/table/FilterToolbar.jsx` |
| **`ViewToggle`** | ❌ | ✅ | ✅ | `src/components/common/table/ViewToggle.jsx` |
| **`StatusBadge`** | ✅ | ✅ | ✅ | `src/components/common/badges/StatusBadge.jsx` |
| **`PriorityBadge`** | ✅ | ✅ | ✅ | `src/components/common/badges/PriorityBadge.jsx` |
| **`RoleBadge`** | ✅ | ✅ | ✅ | `src/components/common/badges/RoleBadge.jsx` |
| **`SideDrawer`** | ✅ | ✅ | ✅ | `src/components/common/drawer/SideDrawer.jsx` |
| **`AuditDiffViewer`** | ✅ | ✅ | ❌ | `src/components/common/drawer/AuditDiffViewer.jsx` |
| **`DonutChartCard`** | ✅ | ✅ | ✅ | `src/components/common/charts/DonutChartCard.jsx` |
| **`LineChartCard`** | ✅ | ❌ | ✅ | `src/components/common/charts/LineChartCard.jsx` |
| **`QuickLogWorkFormCard`**| ❌ | ❌ | ✅ | `src/components/common/forms/QuickLogWorkFormCard.jsx` |

---

## 🗺️ 7. LỘ TRÌNH CÁC BƯỚC THỰC THI (EXECUTION ROADMAP)

- [ ] **Bước 1:** Thực thi cài đặt toàn bộ các thư viện NPM trong mục 3 vào `frontend/package.json`.
- [ ] **Bước 2:** Tạo khung cấu trúc thư mục trong `frontend/src/` theo sơ đồ mục 4.
- [ ] **Bước 3:** Cấu hình Tailwind CSS, Axios Interceptor (`apiClient.js`) và Zustand Auth Store (`useAuthStore.js`).
- [ ] **Bước 4:** Xây dựng bộ **Shared Components dùng chung** tại `src/components/common/` (`Sidebar`, `Header`, `StatCard`, `DataTable`, `StatusBadge`, `SideDrawer`).
- [ ] **Bước 5:** Ghép nối các trang giao diện cụ thể theo từng phân hệ (**Manager** ➔ **Employee** ➔ **Admin**).

---
*Tài liệu này lưu trữ tại `docs/HUONG_DAN_THUC_HIEN_FRONTEND.md` làm kim chỉ nam thực hiện phần Frontend.*
