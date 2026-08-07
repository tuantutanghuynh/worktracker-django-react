# S2-03. TypeScript Cơ bản cho React

## Tại sao cần TypeScript?

```javascript
// JavaScript — không biết data trông như thế nào
function ContactTable({ contacts, onDelete }) {
  // contacts là gì? mảng object có field gì?
  // onDelete nhận tham số gì? trả về gì?
}

// TypeScript — rõ ràng, IDE tự gợi ý
function ContactTable({ contacts, onDelete }: ContactTableProps) {
  // IDE biết contacts là Contact[], có .name, .phone, .email
  // onDelete nhận string (id) và trả về void
}
```

---

## Khởi tạo project TypeScript

```bash
npm create vite@latest my-app -- --template react-ts
```

Hoặc thêm vào project sẵn có:
```bash
npm install -D typescript @types/react @types/react-dom
```

---

## Định nghĩa kiểu dữ liệu

### Interface cho model

```typescript
// src/types/index.ts
export interface Contact {
  _id: string
  name: string
  phone: string
  email: string
  address?: string      // ? = optional, có thể undefined
  group?: string
  createdAt: string
}

export interface User {
  _id: string
  email: string
  fullname: string
  role: 'admin' | 'user'  // union type — chỉ được một trong hai
}

export interface ApiError {
  msg: string
  errors?: { path: string; msg: string }[]
}
```

### Type cho form state

```typescript
// Tách riêng form type (không cần _id, createdAt)
export type ContactForm = Omit<Contact, '_id' | 'createdAt'>

// Hoặc khai báo tường minh
export interface ContactFormData {
  name: string
  phone: string
  email: string
  address: string
  group: string
}
```

---

## Typing cho component props

```tsx
// src/components/ContactTable.tsx
import { Contact } from '../types'

interface ContactTableProps {
  contacts: Contact[]
  loading: boolean
  onDelete: (id: string) => void
}

export default function ContactTable({ contacts, loading, onDelete }: ContactTableProps) {
  // IDE sẽ gợi ý contact.name, contact.phone...
}
```

```tsx
// src/components/PageHeader.tsx
interface PageHeaderProps {
  title: string
  description?: string   // optional
}

export default function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
    </div>
  )
}
```

---

## Typing cho useState

```typescript
// TypeScript tự suy ra từ initial value
const [loading, setLoading] = useState(false)    // boolean
const [keyword, setKeyword] = useState('')         // string

// Cần khai báo tường minh khi initial value là null/mảng rỗng
const [contacts, setContacts] = useState<Contact[]>([])
const [user, setUser] = useState<User | null>(null)
```

---

## Typing cho service functions

```typescript
// src/services/contactService.ts
import { Contact, ContactFormData } from '../types'
import { requestJson, getAuthHeaders } from './apiClient'

export function getContacts(keyword = ''): Promise<Contact[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
  return requestJson(`/contacts${query}`, {
    headers: getAuthHeaders()
  })
}

export function createContact(payload: ContactFormData): Promise<Contact> {
  return requestJson('/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload)
  })
}

export function deleteContact(id: string): Promise<void> {
  return requestJson(`/contacts/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
}
```

---

## Typing cho custom hooks

```typescript
// src/hooks/useForm.ts
import { useState, ChangeEvent } from 'react'

export function useForm<T extends Record<string, unknown>>(initialValues: T) {
  const [form, setForm] = useState<T>(initialValues)

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const reset = () => setForm(initialValues)

  return { form, handleChange, reset }
}
```

---

## tsconfig.json cho React

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- `"strict": true` — bật tất cả kiểm tra nghiêm ngặt
- `"noUnusedLocals"` — báo lỗi khi khai báo biến không dùng

---

## Cấu trúc thư mục với TypeScript

```
src/
├── types/
│   └── index.ts          ← tất cả interface & type dùng chung
├── services/
│   ├── apiClient.ts      ← đổi .js → .ts
│   ├── authService.ts
│   └── contactService.ts
├── hooks/
│   ├── useForm.ts
│   └── useContacts.ts
└── components/
    ├── ContactTable.tsx  ← .tsx cho file có JSX
    └── PageHeader.tsx
```

---

## Các lỗi TypeScript hay gặp

```typescript
// Lỗi: Object is possibly null
const user = useAuth().user
user.email  // TS báo lỗi vì user có thể null

// Fix: kiểm tra trước
if (user) {
  user.email  // an toàn
}

// Hoặc optional chaining
user?.email

// Lỗi: Type 'string | undefined' is not assignable to type 'string'
const name: string = contact.address  // address là optional (string | undefined)

// Fix: cung cấp giá trị mặc định
const name: string = contact.address ?? ''
```

---

## Điểm cần nhớ

> **`.tsx` cho file có JSX, `.ts` cho file không có JSX** — service files dùng `.ts`, component files dùng `.tsx`.

> **Không dùng `any`** — `any` tắt kiểm tra TypeScript, làm mất lợi ích. Nếu không biết kiểu, dùng `unknown` và type-check trước khi dùng.

> **`interface` vs `type`** — Dùng `interface` cho object shapes (Contact, User). Dùng `type` cho union types, tuple, hoặc alias (`type ID = string`).

> **TypeScript chạy trước khi lên production** — lỗi TypeScript chỉ xuất hiện lúc compile, không phải runtime. Code vẫn chạy được nhưng nên fix tất cả TS errors trước khi deploy.
