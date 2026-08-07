# S2-04. Error Handling

## Các loại lỗi cần xử lý

| Loại lỗi | Ví dụ | Cách xử lý |
|---|---|---|
| Lỗi API (4xx) | Email đã tồn tại, không tìm thấy | Hiển thị message từ server |
| Lỗi mạng | Không kết nối được server | Thông báo "Mất kết nối" |
| Lỗi JavaScript | Cannot read property of undefined | Error Boundary |
| Lỗi validation | Bỏ trống field bắt buộc | Kiểm tra trước khi gửi |

---

## Error Boundary — bắt lỗi JavaScript

Khi một component throw error, React mặc định crash toàn bộ app. `ErrorBoundary` bắt lỗi và hiển thị fallback UI thay vì màn hình trắng.

```jsx
// src/components/ErrorBoundary.jsx
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
    // Gửi lên Sentry/LogRocket nếu có
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-5 text-center">
          <h4 className="text-danger">Đã xảy ra lỗi</h4>
          <p className="text-muted">{this.state.error?.message}</p>
          <button
            className="btn btn-outline-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Thử lại
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

Bọc vào `main.jsx`:

```jsx
<AuthProvider>
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
</AuthProvider>
```

---

## Toast Notification — thông báo toàn app

Thay vì `alert` hay `<div>` local trong từng page, dùng toast hiển thị ở góc màn hình.

### Dựng toast đơn giản với Context

```jsx
// src/contexts/ToastContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'danger'),
    info: (msg) => addToast(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}
        className="d-flex flex-column gap-2"
      >
        {toasts.map((t) => (
          <div key={t.id} className={`alert alert-${t.type} shadow-sm mb-0`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast phải dùng trong <ToastProvider>')
  return context
}
```

Thêm vào `main.jsx`:

```jsx
<AuthProvider>
  <ToastProvider>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ToastProvider>
</AuthProvider>
```

Dùng trong page:

```jsx
// Trước: state message local trong từng page
const [message, setMessage] = useState('')
setMessage('Xóa thành công!')

// Sau: toast toàn cục
const toast = useToast()
toast.success('Xóa thành công!')
toast.error(err.message)
```

---

## Centralized Error Handler

Tập trung xử lý lỗi trong `apiClient.js`:

```javascript
// src/services/apiClient.js
async function parseResponse(res) {
  const contentType = res.headers.get('Content-Type') || ''
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text()

  if (!res.ok) {
    // Xử lý các loại lỗi từ backend
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'  // Force redirect khi hết session
      throw new Error('Phiên đăng nhập hết hạn')
    }

    if (res.status === 403) {
      throw new Error('Bạn không có quyền thực hiện thao tác này')
    }

    if (res.status === 404) {
      throw new Error('Không tìm thấy dữ liệu')
    }

    const message = typeof data === 'string' ? data : data.msg || 'Có lỗi xảy ra'
    throw new Error(message)
  }
  return data
}
```

---

## Pattern: Page xử lý lỗi gọn

```jsx
// ContactListPage.jsx — sau khi có toast
import { useToast } from '../contexts/ToastContext'
import { useContacts } from '../hooks/useContacts'

export default function ContactListPage() {
  const toast = useToast()
  const { contacts, loading, remove } = useContacts()

  const handleDelete = async (id) => {
    if (!confirm('Xác nhận xóa?')) return
    try {
      await remove(id)
      toast.success('Đã xóa liên hệ')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <ContactTable contacts={contacts} loading={loading} onDelete={handleDelete} />
  )
}
```

---

## Validation trước khi submit

```jsx
// Kiểm tra phía client trước khi gọi API
const validate = (form) => {
  if (!form.name.trim()) return 'Tên không được để trống'
  if (!form.phone && !form.email) return 'Phải có ít nhất số điện thoại hoặc email'
  return null  // null = không có lỗi
}

const handleSubmit = async (e) => {
  e.preventDefault()
  const validationError = validate(form)
  if (validationError) {
    toast.error(validationError)
    return
  }
  // Gọi API
}
```

---

## Điểm cần nhớ

> **Error Boundary không bắt được lỗi trong event handler** — chỉ bắt lỗi trong render. Lỗi trong `onClick`, `onSubmit` phải dùng `try/catch` thủ công.

> **Error Boundary phải là class component** — React chưa có hook tương đương. Đây là trường hợp hiếm hoi class component vẫn cần thiết.

> **401 Unauthorized → redirect về login** — khi server trả 401, token hết hạn. Nên xử lý tập trung trong `parseResponse` thay vì check từng page.

> **Không nuốt lỗi** — không được viết `catch (err) {}` rỗng. Ít nhất phải `console.error(err)` hoặc hiển thị thông báo cho user. Nuốt lỗi khiến bug vô hình.
