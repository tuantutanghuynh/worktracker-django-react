# S1-01. Setup & Cấu trúc thư mục

## Tech stack

| Thư viện | Vai trò | Lý do chọn |
|---|---|---|
| React 18 + Vite | UI framework + build tool | Nhanh, cấu hình đơn giản |
| react-router-dom v6 | Điều hướng trang | Chuẩn của React |
| fetch (native) | Gọi API | Có sẵn trong browser, không cần cài thêm |
| Bootstrap 5 | CSS framework | Nhanh có giao diện đẹp |

---

## Khởi tạo project

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm install react-router-dom bootstrap
```

Thêm Bootstrap vào `src/main.jsx`:

```jsx
import 'bootstrap/dist/css/bootstrap.min.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

---

## File `.env`

Tạo ở thư mục gốc (cùng cấp `package.json`):

```
VITE_API_BASE=http://localhost:3000/api
```

Thêm vào `.gitignore`:
```
.env
.env.local
```

Tạo `.env.example` để người khác biết cần khai báo gì:
```
VITE_API_BASE=http://localhost:3000/api
```

---

## Cấu trúc thư mục

```
src/
├── main.jsx                    ← điểm vào, import Bootstrap
├── App.jsx                     ← định nghĩa tất cả routes
│
├── layouts/
│   └── MainLayout.jsx          ← navbar + <Outlet> dùng chung
│
├── pages/                      ← mỗi file = 1 trang
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── ContactListPage.jsx
│   ├── ContactCreatePage.jsx
│   └── ContactEditPage.jsx
│
├── components/                 ← UI piece nhỏ, tái sử dụng
│   ├── PrivateRoute.jsx
│   ├── ContactTable.jsx
│   └── PageHeader.jsx
│
└── services/                   ← tất cả logic gọi API
    ├── apiClient.js            ← fetch wrapper dùng chung
    ├── authService.js          ← login, register
    └── contactService.js       ← CRUD contacts
```

### Quy tắc của từng tầng

| Tầng | Được phép | Không được phép |
|---|---|---|
| `pages/` | Gọi service, quản lý state, điều phối component | Viết JSX UI phức tạp, gọi fetch trực tiếp |
| `components/` | Render UI, nhận props | Gọi API, dùng useNavigate để chuyển trang |
| `services/` | Gọi fetch, xử lý response | Dùng useState, import component React |
| `layouts/` | Navbar, footer, `<Outlet>` | Logic nghiệp vụ |

---

## App.jsx — cấu trúc routes

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import PrivateRoute from './components/PrivateRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ContactListPage from './pages/ContactListPage'
import ContactCreatePage from './pages/ContactCreatePage'
import ContactEditPage from './pages/ContactEditPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public — không cần đăng nhập */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — phải đăng nhập, dùng layout chung */}
        <Route element={<PrivateRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/contacts" element={<ContactListPage />} />
            <Route path="/contacts/new" element={<ContactCreatePage />} />
            <Route path="/contacts/:id/edit" element={<ContactEditPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/contacts" />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### Luồng route lồng nhau

```
Request /contacts
  → PrivateRoute: có token? → <Outlet>
    → MainLayout: render navbar + <Outlet>
      → ContactListPage: render nội dung trang
```

---

## Điểm cần nhớ

> **Mỗi tầng chỉ làm 1 việc** — page điều phối, component render, service gọi API. Khi code bắt đầu "làm nhiều việc" trong 1 file là lúc cần tách ra.

> **`services/` không import gì từ React** — nếu file service có `import { useState }` là sai chỗ.

> **`components/` không gọi API** — nếu component cần dữ liệu, nhận qua props từ page.
