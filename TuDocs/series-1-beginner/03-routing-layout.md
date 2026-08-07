# S1-03. Routing & Layout

## React Router v6 — khái niệm cốt lõi

| Concept | Giải thích |
|---|---|
| `<BrowserRouter>` | Bọc toàn app, cung cấp context routing |
| `<Routes>` | Container chứa tất cả `<Route>` |
| `<Route path element>` | Gắn component với URL |
| `<Outlet>` | "Lỗ hổng" để route con render vào |
| `<Navigate to>` | Redirect sang URL khác |
| `useNavigate()` | Điều hướng bằng code |
| `useParams()` | Lấy tham số từ URL (`:id`) |

---

## PrivateRoute — bảo vệ trang cần đăng nhập

```jsx
// src/components/PrivateRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'

export default function PrivateRoute() {
  const token = localStorage.getItem('token')
  return token ? <Outlet /> : <Navigate to="/login" replace />
}
```

`<Outlet />` nghĩa là "render route con ở đây". Khi dùng như wrapper trong `App.jsx`:

```jsx
<Route element={<PrivateRoute />}>
  <Route path="/contacts" element={<ContactListPage />} />
</Route>
```

Luồng: `PrivateRoute` kiểm tra token → nếu có, `<Outlet>` render `ContactListPage`.

---

## MainLayout — navbar dùng chung

```jsx
// src/layouts/MainLayout.jsx
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

export default function MainLayout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="container py-4">
      <nav className="d-flex justify-content-between align-items-center
                      bg-white border rounded shadow-sm px-4 py-2 mb-4">
        <Link className="fw-bold text-decoration-none fs-5" to="/contacts">
          MyApp
        </Link>
        <div className="d-flex gap-3 align-items-center">
          <NavLink
            className={({ isActive }) =>
              'nav-link ' + (isActive ? 'fw-semibold text-primary' : 'text-secondary')
            }
            to="/contacts"
          >
            Danh sách
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              'nav-link ' + (isActive ? 'fw-semibold text-primary' : 'text-secondary')
            }
            to="/contacts/new"
          >
            Thêm mới
          </NavLink>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>
      </nav>

      <Outlet />
    </div>
  )
}
```

### NavLink vs Link

- `<Link>` — link thường, không thay đổi style
- `<NavLink>` — nhận callback `({ isActive })` để thêm class khi đang ở trang đó

---

## PageHeader — tiêu đề trang tái sử dụng

```jsx
// src/components/PageHeader.jsx
export default function PageHeader({ title, description }) {
  return (
    <div className="mb-4">
      <h4 className="mb-1">{title}</h4>
      {description && <p className="text-muted mb-0">{description}</p>}
    </div>
  )
}
```

Dùng trong page:
```jsx
<PageHeader title="Danh bạ" description="Quản lý tất cả liên hệ của bạn" />
```

---

## App.jsx đầy đủ

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

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

---

## Diagram: Nested Routes

```
<BrowserRouter>
  <Routes>
    /login          → <LoginPage>
    /register       → <RegisterPage>

    <PrivateRoute>            ← kiểm tra token
      <MainLayout>            ← navbar + <Outlet>
        /contacts             → <ContactListPage>
        /contacts/new         → <ContactCreatePage>
        /contacts/:id/edit    → <ContactEditPage>
```

---

## Điểm cần nhớ

> **`replace` trong `<Navigate replace>`** — thay thế entry lịch sử trình duyệt thay vì thêm mới. Người dùng nhấn Back sẽ không bị kẹt vòng lặp login → redirect.

> **`<Outlet />` phải có trong layout** — nếu quên `<Outlet>`, route con không render được dù URL đúng. Lỗi này hay gặp và khó debug.

> **`useNavigate` chỉ dùng được trong `<BrowserRouter>`** — nếu gọi `useNavigate()` bên ngoài `<BrowserRouter>`, sẽ báo lỗi `useNavigate() may be used only in the context of a Router`.
