# S2-01. Custom Hooks

## Custom hook là gì?

Custom hook là function JavaScript bình thường, tên bắt đầu bằng `use`, bên trong dùng React hooks.

**Vấn đề của Series 1**: Mỗi page đều lặp lại pattern giống nhau:

```jsx
// Lặp trong ContactListPage
const [contacts, setContacts] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')

const load = async () => {
  setLoading(true)
  try { ... } catch (err) { setError(err.message) } finally { setLoading(false) }
}
useEffect(() => { load() }, [])
```

```jsx
// Lặp tương tự trong UserListPage, ProductListPage...
const [users, setUsers] = useState([])
const [loading, setLoading] = useState(false)
// ...y hệt
```

Custom hook giải quyết bằng cách gom logic lặp lại vào một chỗ.

---

## `useApi` — hook gọi API tổng quát

```javascript
// src/hooks/useApi.js
import { useState, useEffect } from 'react'

export function useApi(apiFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const execute = async (...args) => {
    setLoading(true)
    setError('')
    try {
      const result = await apiFn(...args)
      setData(result)
      return result
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra')
      throw err
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    execute()
  }, deps)

  return { data, loading, error, reload: execute }
}
```

Dùng trong page — thay 15 dòng boilerplate bằng 1 dòng:

```jsx
// ContactListPage.jsx — trước (Series 1)
const [contacts, setContacts] = useState([])
const [loading, setLoading] = useState(false)
const loadContacts = async () => {
  setLoading(true)
  try {
    const data = await getContacts()
    setContacts(data)
  } finally { setLoading(false) }
}
useEffect(() => { loadContacts() }, [])

// ContactListPage.jsx — sau (Series 2)
const { data: contacts = [], loading, error, reload } = useApi(getContacts)
```

---

## `useContacts` — hook chuyên biệt

Khi cần thêm logic như search, tạo hook riêng cho domain:

```javascript
// src/hooks/useContacts.js
import { useState, useEffect } from 'react'
import { getContacts, deleteContact } from '../services/contactService'

export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = async (kw = keyword) => {
    setLoading(true)
    setError('')
    try {
      const data = await getContacts(kw)
      setContacts(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const remove = async (id) => {
    await deleteContact(id)
    load()  // reload sau khi xóa
  }

  const search = (kw) => {
    setKeyword(kw)
    load(kw)
  }

  return { contacts, loading, error, keyword, search, remove }
}
```

Page trở nên cực kỳ gọn:

```jsx
// ContactListPage.jsx
import { useContacts } from '../hooks/useContacts'

export default function ContactListPage() {
  const { contacts, loading, error, keyword, search, remove } = useContacts()

  return (
    <div>
      <SearchBar value={keyword} onSearch={search} />
      {error && <div className="alert alert-danger">{error}</div>}
      <ContactTable contacts={contacts} loading={loading} onDelete={remove} />
    </div>
  )
}
```

---

## `useForm` — hook quản lý form

```javascript
// src/hooks/useForm.js
import { useState } from 'react'

export function useForm(initialValues) {
  const [form, setForm] = useState(initialValues)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const reset = () => setForm(initialValues)

  const set = (values) => setForm((prev) => ({ ...prev, ...values }))

  return { form, handleChange, reset, set }
}
```

Dùng trong LoginPage:

```jsx
// LoginPage.jsx
import { useForm } from '../hooks/useForm'

export default function LoginPage() {
  const { form, handleChange, reset } = useForm({ email: '', pwd: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = await login(form)
      localStorage.setItem('token', data.token)
      navigate('/contacts')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" value={form.email} onChange={handleChange} />
      <input name="pwd" type="password" value={form.pwd} onChange={handleChange} />
      <button type="submit">Đăng nhập</button>
    </form>
  )
}
```

---

## Cấu trúc thư mục với hooks

```
src/
├── hooks/
│   ├── useApi.js       ← hook gọi API tổng quát
│   ├── useForm.js      ← hook quản lý form
│   ├── useContacts.js  ← hook cho contacts domain
│   └── useAuth.js      ← hook auth (xem bài tiếp theo)
```

---

## Quy tắc của Custom Hooks

1. **Tên bắt đầu bằng `use`** — bắt buộc, React dùng để kiểm tra Rules of Hooks
2. **Trả về object hoặc array** — object cho nhiều giá trị tên, array cho pattern `[value, setter]`
3. **Có thể dùng hooks khác bên trong** — `useState`, `useEffect`, `useCallback`...
4. **Không return JSX** — hooks trả về data/function, không trả về component

---

## Điểm cần nhớ

> **Custom hook không tạo shared state** — mỗi component gọi `useContacts()` nhận một state riêng. Muốn share state giữa nhiều component, dùng Context (bài tiếp theo).

> **Hook chạy lại khi component re-render** — nếu `useEffect` trong hook có dependency array sai, có thể tạo vòng lặp vô tận. Luôn kiểm tra deps cẩn thận.

> **Đừng tạo hook cho mọi thứ** — 3 dòng logic không cần tách thành hook. Hook hữu ích khi logic phức tạp và cần tái sử dụng ở nhiều nơi.
