# S2-02. Auth Context

## Vấn đề của Series 1

Token được đọc thẳng từ `localStorage` trong service layer mỗi lần gọi API — không có "nguồn sự thật" duy nhất.  
Hơn nữa, nếu token thay đổi (login/logout), không có cơ chế tự động cập nhật UI.

```
Series 1: service đọc localStorage mỗi lần
          → không biết khi nào token thay đổi
          → phải navigate thủ công, reload trang

Series 2: AuthContext là nguồn sự thật duy nhất
          → mọi component dùng useAuth() để biết trạng thái
          → khi login/logout, tất cả component cập nhật tự động
```

---

## Tạo AuthContext

```jsx
// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')

  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken('')
  }, [])

  const isLoggedIn = Boolean(token)

  return (
    <AuthContext.Provider value={{ token, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  }
  return context
}
```

---

## Bọc App bằng AuthProvider

```jsx
// src/main.jsx
import { AuthProvider } from './contexts/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
```

---

## Cập nhật PrivateRoute dùng useAuth

```jsx
// src/components/PrivateRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute() {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />
}
```

---

## Cập nhật LoginPage dùng useAuth

```jsx
// src/pages/LoginPage.jsx
import { useAuth } from '../contexts/AuthContext'
import { login } from '../services/authService'

export default function LoginPage() {
  const { login: setAuth } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = await login(form)
      setAuth(data.token)        // cập nhật Context
      navigate('/contacts')
    } catch (err) {
      setError(err.message)
    }
  }
}
```

---

## Cập nhật MainLayout dùng useAuth

```jsx
// src/layouts/MainLayout.jsx
import { useAuth } from '../contexts/AuthContext'

export default function MainLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="container py-4">
      <nav>
        {/* ... */}
        <button onClick={handleLogout}>Đăng xuất</button>
      </nav>
      <Outlet />
    </div>
  )
}
```

---

## Cập nhật apiClient.js — lấy token từ closure

Khi dùng Context, services vẫn đọc token từ localStorage (không import Context vào service). Điều này là **đúng** — service không nên phụ thuộc vào React:

```javascript
// src/services/apiClient.js — không thay đổi
export function getAuthHeaders() {
  const token = localStorage.getItem('token')  // vẫn đọc localStorage
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}
```

Context đồng bộ state React với localStorage — khi `login()` được gọi, cả `token` state và localStorage đều cập nhật.

---

## Cấu trúc thư mục với Context

```
src/
├── contexts/
│   └── AuthContext.jsx   ← Context + Provider + useAuth hook
├── hooks/
│   ├── useContacts.js
│   └── useForm.js
```

---

## Mở rộng: useAuth với user info

```jsx
// AuthContext.jsx mở rộng — lưu thêm thông tin user
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(newToken)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken('')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, isLoggedIn: Boolean(token), login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

Hiển thị tên user trong navbar:
```jsx
const { user, logout } = useAuth()
// user.fullname, user.email...
```

---

## Điểm cần nhớ

> **`createContext(null)` vs `createContext({})`** — dùng `null` để có thể kiểm tra trong `useAuth()`: nếu context là `null`, nghĩa là không có Provider bao ngoài → throw Error rõ ràng.

> **`useCallback` cho login/logout** — `useCallback` ngăn function được tạo mới mỗi render. Quan trọng khi truyền hàm vào deps của `useEffect`.

> **Không lưu password vào Context** — Context có thể bị đọc bởi React DevTools. Chỉ lưu token và thông tin không nhạy cảm.

> **Context không phải state management** — Context phù hợp cho data ít thay đổi (auth, theme). Nếu data thay đổi thường xuyên (danh sách contacts), dùng local state hoặc TanStack Query (Series 3).
