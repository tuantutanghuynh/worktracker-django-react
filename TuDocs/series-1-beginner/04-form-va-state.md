# S1-04. Form & State Management

## Object state cho form

Thay vì khai báo state riêng từng field:

```jsx
// BAD: rời rạc, khó mở rộng
const [email, setEmail] = useState('')
const [pwd, setPwd] = useState('')
const [fullname, setFullname] = useState('')
```

Gom vào một object:

```jsx
// GOOD: gọn, dễ truyền xuống component
const [form, setForm] = useState({
  email: '',
  pwd: '',
  fullname: ''
})
```

---

## `handleChange` dùng chung

```jsx
const handleChange = (e) => {
  setForm({ ...form, [e.target.name]: e.target.value })
}
```

- `...form` — giữ nguyên tất cả field khác
- `[e.target.name]` — computed property key: lấy giá trị của `name` làm key
- `e.target.value` — giá trị người dùng vừa nhập

Input **bắt buộc** phải có `name` khớp với key trong object:

```jsx
<input name="email" value={form.email} onChange={handleChange} />
<input name="pwd" value={form.pwd} onChange={handleChange} />
```

---

## Constant `emptyForm`

Đặt outside component để tái sử dụng khi reset form:

```jsx
// Đặt ngoài component, không tạo lại mỗi render
const emptyForm = { email: '', pwd: '', fullname: '' }

function MyPage() {
  const [form, setForm] = useState(emptyForm)

  const handleSuccess = () => {
    setForm(emptyForm)  // reset form về trạng thái rỗng
  }
}
```

---

## Pattern: Loading + Error state

```jsx
const [loading, setLoading] = useState(false)
const [message, setMessage] = useState('')

const handleSubmit = async (e) => {
  e.preventDefault()
  setMessage('')      // xóa thông báo cũ

  setLoading(true)
  try {
    const data = await someService(form)
    setMessage('Thành công!')
    setForm(emptyForm)
  } catch (err) {
    setMessage(err.message || 'Có lỗi xảy ra')
  } finally {
    setLoading(false)  // luôn tắt loading dù thành công hay thất bại
  }
}
```

`finally` quan trọng: nếu API lỗi mà không có `finally { setLoading(false) }`, nút sẽ bị vô hiệu hóa mãi mãi.

---

## Render thông báo

```jsx
{message && (
  <div className={`alert ${message.includes('thành công') || message.includes('success')
    ? 'alert-success'
    : 'alert-danger'}`}>
    {message}
  </div>
)}
```

Hoặc đơn giản hơn: tách thành 2 state riêng `error` và `successMsg`.

---

## Ví dụ đầy đủ: LoginPage

```jsx
// src/pages/LoginPage.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/authService'

const emptyForm = { email: '', pwd: '' }

export default function LoginPage() {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await login(form)
      localStorage.setItem('token', data.token)
      navigate('/contacts')
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-4">
        <div className="card shadow-sm">
          <div className="card-body">
            <h4 className="card-title mb-3">Đăng nhập</h4>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Mật khẩu</label>
                <input
                  type="password"
                  name="pwd"
                  className="form-control"
                  value={form.pwd}
                  onChange={handleChange}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={loading}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            <p className="mt-3 text-center text-muted">
              Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## useEffect — fetch dữ liệu khi load trang

```jsx
import { useState, useEffect } from 'react'
import { getContact } from '../services/contactService'

export default function ContactEditPage() {
  const { id } = useParams()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)  // true vì cần load ngay

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getContact(id)
        const { name, phone, email, address, group } = data
        setForm({ name, phone, email, address, group })
      } catch (err) {
        // xử lý lỗi
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])  // chạy lại khi id thay đổi

  if (loading) return <div className="text-center py-5">Đang tải...</div>

  return ( /* form */ )
}
```

---

## Điểm cần nhớ

> **`e.preventDefault()`** — form HTML mặc định reload trang khi submit. Phải gọi `preventDefault()` để xử lý bằng JavaScript.

> **`disabled={loading}`** — vô hiệu hóa nút submit khi đang gọi API để tránh double-submit.

> **`useState(true)` cho loading ban đầu** — nếu trang cần fetch dữ liệu ngay khi load (như EditPage), khởi tạo `loading = true` để hiện "Đang tải..." ngay, không hiện form rỗng.

> **Destructure khi set form từ API** — `const { name, phone } = data` thay vì `setForm(data)`. Nếu set cả object `data` vào form, sẽ lẫn vào các field không cần như `_id`, `createdAt`, backend có thể từ chối.
