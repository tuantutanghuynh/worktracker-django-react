# S1-05. Component Pattern — Tách UI đúng cách

## Nguyên tắc: Thin Page

Page = điều phối. Component = hiển thị.

```
ContactListPage.jsx      ← biết: fetch, delete, search
    └── ContactTable.jsx ← biết: render bảng từ props
    └── PageHeader.jsx   ← biết: render tiêu đề
```

Page không nên có JSX phức tạp. Component không nên gọi API.

---

## Ví dụ: ContactListPage (thin)

```jsx
// src/pages/ContactListPage.jsx
import { useState, useEffect } from 'react'
import { getContacts, deleteContact } from '../services/contactService'
import PageHeader from '../components/PageHeader'
import ContactTable from '../components/ContactTable'

export default function ContactListPage() {
  const [contacts, setContacts] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadContacts = async (kw = '') => {
    setLoading(true)
    try {
      const data = await getContacts(kw)
      setContacts(data)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts() }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    loadContacts(keyword)
  }

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return
    try {
      await deleteContact(id)
      loadContacts(keyword)
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader title="Danh bạ" description="Quản lý liên hệ của bạn" />

      {message && <div className="alert alert-info">{message}</div>}

      <div className="d-flex gap-2 mb-3">
        <form className="d-flex gap-2 flex-grow-1" onSubmit={handleSearch}>
          <input
            type="text"
            className="form-control"
            placeholder="Tìm theo tên..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn btn-outline-secondary">Tìm</button>
        </form>
        <a href="/contacts/new" className="btn btn-primary">+ Thêm</a>
      </div>

      <ContactTable
        contacts={contacts}
        loading={loading}
        onDelete={handleDelete}
      />
    </div>
  )
}
```

---

## ContactTable — component hiển thị

```jsx
// src/components/ContactTable.jsx
import { Link } from 'react-router-dom'

export default function ContactTable({ contacts, loading, onDelete }) {
  if (loading) {
    return <div className="text-center py-4 text-muted">Đang tải...</div>
  }

  if (contacts.length === 0) {
    return <p className="text-muted">Không tìm thấy liên hệ nào.</p>
  }

  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover align-middle">
        <thead className="table-light">
          <tr>
            <th>Tên</th>
            <th>Điện thoại</th>
            <th>Email</th>
            <th>Nhóm</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c._id}>
              <td className="fw-semibold">{c.name}</td>
              <td>{c.phone}</td>
              <td>{c.email}</td>
              <td>
                {c.group && (
                  <span className="badge bg-secondary">{c.group}</span>
                )}
              </td>
              <td>
                <div className="d-flex gap-2">
                  <Link
                    to={`/contacts/${c._id}/edit`}
                    className="btn btn-outline-primary btn-sm"
                  >
                    Sửa
                  </Link>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => onDelete(c._id)}
                  >
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Khi nào nên tách component?

| Tình huống | Nên tách? |
|---|---|
| JSX dài > 50 dòng trong page | Có |
| Cùng một UI xuất hiện ở 2+ trang | Có |
| Component có thể test độc lập | Có |
| Chỉ dùng một lần, ngắn | Không cần |

---

## Truyền props đúng cách

### Props là data + callback

```jsx
// Page truyền xuống:
<ContactTable
  contacts={contacts}    // data
  loading={loading}      // trạng thái
  onDelete={handleDelete} // callback — xử lý ở page
/>

// Component nhận:
function ContactTable({ contacts, loading, onDelete }) {
  // contacts: dùng để render
  // loading: dùng để hiển thị trạng thái
  // onDelete: gọi khi nhấn nút Xóa
}
```

### Quy ước đặt tên props callback

- `on` + động từ: `onDelete`, `onChange`, `onSubmit`, `onSuccess`
- Không đặt theo implementation: `handleDelete` (đây là tên ở page, không phải tên prop)

---

## ContactForm — tái sử dụng cho Create & Edit

Nếu form Create và Edit giống nhau, tách thành component dùng chung:

```jsx
// src/components/ContactForm.jsx
export default function ContactForm({ form, onChange, onSubmit, loading, submitLabel }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="mb-3">
        <label className="form-label">Họ tên *</label>
        <input
          className="form-control"
          name="name"
          value={form.name}
          onChange={onChange}
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label">Số điện thoại</label>
        <input
          className="form-control"
          name="phone"
          value={form.phone}
          onChange={onChange}
        />
      </div>
      {/* ... các field khác */}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Đang lưu...' : submitLabel}
      </button>
    </form>
  )
}
```

Dùng trong cả CreatePage và EditPage:

```jsx
// ContactCreatePage.jsx
<ContactForm
  form={form}
  onChange={handleChange}
  onSubmit={handleSubmit}
  loading={loading}
  submitLabel="Tạo mới"
/>

// ContactEditPage.jsx
<ContactForm
  form={form}
  onChange={handleChange}
  onSubmit={handleSubmit}
  loading={loading}
  submitLabel="Cập nhật"
/>
```

---

## Điểm cần nhớ

> **Page không import component con để gọi service** — nếu `ContactTable` import `deleteContact` và tự gọi, page mất kiểm soát. Mọi thao tác API nên ở page, truyền callback xuống component.

> **Component không nên `useNavigate()`** — điều hướng là quyết định của page. Component chỉ nhận `onSuccess` callback và page quyết định navigate đi đâu.

> **Không over-split** — tách component chỉ khi có lý do rõ ràng (tái sử dụng, quá dài). Ba dòng JSX không cần tách thành component riêng.
