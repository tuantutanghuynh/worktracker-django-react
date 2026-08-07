# S1-02. API Client & Service Layer

## Tại sao cần service layer?

Không có service layer — gọi fetch thẳng trong component:

```jsx
// BAD: logic HTTP nằm trong component
function ContactListPage() {
  const loadContacts = async () => {
    const token = localStorage.getItem('token')
    const res = await fetch('http://localhost:3000/api/contacts', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    setContacts(data)
  }
}
```

Vấn đề: URL, header, error handling bị lặp khắp nơi. Đổi API thì phải sửa mọi file.

Có service layer:

```jsx
// GOOD: component không biết gì về HTTP
function ContactListPage() {
  const loadContacts = async () => {
    const data = await getContacts()
    setContacts(data)
  }
}
```

---

## `services/apiClient.js` — nền tảng chung

```javascript
// src/services/apiClient.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'

async function parseResponse(res) {
  const contentType = res.headers.get('Content-Type') || ''
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text()

  if (!res.ok) {
    const message = typeof data === 'string' ? data : data.msg || 'Có lỗi xảy ra'
    throw new Error(message)
  }
  return data
}

export async function requestJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options)
  return parseResponse(res)
}

export function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}
```

### Giải thích từng phần

**`parseResponse`** — xử lý response một lần cho tất cả:
- Đọc body đúng định dạng (JSON hoặc text)
- Nếu HTTP status >= 400 → throw Error với message từ backend
- Component nhận Error qua `catch (err)` → lấy `err.message`

**`requestJson`** — wrapper ngắn gọn, nhận path + options:
```javascript
// Gọi GET /contacts
requestJson('/contacts', { headers: getAuthHeaders() })

// Gọi POST /contacts với body
requestJson('/contacts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  body: JSON.stringify(payload)
})
```

**`getAuthHeaders`** — đọc token từ localStorage, trả về object header:
```javascript
getAuthHeaders()
// → { 'Authorization': 'Bearer eyJhbG...' }
// hoặc {} nếu không có token
```

---

## `services/authService.js`

```javascript
// src/services/authService.js
import { requestJson } from './apiClient'

export function login(form) {
  return requestJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form)
  })
}

export function register(form) {
  return requestJson('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form)
  })
}
```

File này không biết gì về React — chỉ gọi HTTP và trả về data (hoặc throw Error).

---

## `services/contactService.js`

```javascript
// src/services/contactService.js
import { requestJson, getAuthHeaders } from './apiClient'

export function getContacts(keyword = '') {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return requestJson(`/contacts${query}`, {
    headers: getAuthHeaders()
  })
}

export function getContact(id) {
  return requestJson(`/contacts/${id}`, {
    headers: getAuthHeaders()
  })
}

export function createContact(payload) {
  return requestJson('/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload)
  })
}

export function updateContact(id, payload) {
  return requestJson(`/contacts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload)
  })
}

export function deleteContact(id) {
  return requestJson(`/contacts/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
}
```

---

## Cách dùng trong component

```jsx
import { getContacts, deleteContact } from '../services/contactService'

// Gọi và nhận data
const data = await getContacts('nguyen')

// Bắt lỗi
try {
  await deleteContact(id)
} catch (err) {
  setMessage(err.message)  // err.message đến từ parseResponse
}
```

---

## Điểm cần nhớ

> **`...getAuthHeaders()`** — spread operator gộp headers. Nếu không spread, chỉ có `Authorization` mà không có `Content-Type`:
> ```javascript
> // SAI
> headers: getAuthHeaders()
> // → { Authorization: '...' }   — mất Content-Type
>
> // ĐÚNG
> headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
> // → { 'Content-Type': 'application/json', 'Authorization': '...' }
> ```

> **Service function trả về Promise** — `getContacts()` không trả về data ngay, phải dùng `await`. Nếu quên `await`, `data` sẽ là Promise object, không phải mảng.

> **`encodeURIComponent`** — mã hóa keyword trước khi đưa vào URL. Nếu keyword có khoảng trắng hay ký tự đặc biệt mà không encode, URL sẽ bị lỗi.
