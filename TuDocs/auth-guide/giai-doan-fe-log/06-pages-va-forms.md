# 06 — Pages & Forms: react-hook-form + zod

## Vì sao dùng `react-hook-form` thay vì `useState` cho từng input?

Cách đơn giản nhất để làm form trong React: `useState` cho mỗi field:

```js
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
// → mỗi ký tự gõ vào = 1 lần re-render toàn component
```

Với form nhỏ (2-3 field) cách này ổn. Nhưng `react-hook-form` dùng cách
khác: **uncontrolled inputs** — không lưu giá trị trong state React, chỉ
đọc khi cần (submit). Lợi ích:

- Không re-render khi gõ → mượt hơn với form nhiều field
- Validation tích hợp sẵn, error message từng field rõ ràng
- Tích hợp tốt với `zod` để validate schema

## Vì sao dùng `zod` cho validation?

`zod` cho phép định nghĩa "shape" của dữ liệu một lần, dùng lại nhiều chỗ:

```js
const schema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
})
```

`zodResolver(schema)` nối `zod` với `react-hook-form` — form tự validate
theo schema này trước khi gọi `handleSubmit`. Không cần tự viết
`if (!email.includes('@'))` hay tương tự.

## Pattern thống nhất trong mọi page

```jsx
const schema = z.object({ ... })   // Định nghĩa rules

export default function XxxPage() {
    const { handleXxx, loading, error } = useXxx()   // Hook xử lý logic
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema)
    })

    return (
        <form onSubmit={handleSubmit(handleXxx)}>
            <input {...register('fieldName')} />
            {errors.fieldName && <p>{errors.fieldName.message}</p>}
            ...
        </form>
    )
}
```

`handleSubmit(handleXxx)` — `handleSubmit` từ react-hook-form validate form
**trước**, nếu pass thì mới gọi `handleXxx` (hàm từ hook) với dữ liệu đã
validated. Nếu validate fail, hiện lỗi từ `errors`, KHÔNG gọi `handleXxx`.

## Phân biệt `error` vs `errors` — lỗi hay gặp nhất

```js
const { handleLogin, loading, error } = useLogin()     // error = string API error
const { formState: { errors } } = useForm({...})       // errors = object validation errors
```

| Biến | Kiểu | Nguồn | Dùng để |
|------|------|--------|---------|
| `error` (số ít) | `string` | Hook (API call fail) | Hiện lỗi toàn form: `{error && <p>{error}</p>}` |
| `errors` (số nhiều) | `object` | react-hook-form | Hiện lỗi từng field: `{errors.email && <p>{errors.email.message}</p>}` |

**Đây là lỗi xuất hiện nhiều nhất trong session này** — viết `error.email`
thay vì `errors.email`. `error` là string nên `.email` là `undefined` →
không hiện lỗi validation, khó debug.

## `LoginPage.jsx`

```jsx
const schema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
    const { handleLogin, loading, error } = useLogin()
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema)
    })

    return (
        <div>
            <h4>Sign in to WorkTracker</h4>

            {error && <p>{error}</p>}

            <form onSubmit={handleSubmit(handleLogin)}>
                <div>
                    <label>Email</label>
                    <input type='email' {...register('email')} />
                    {errors.email && <p>{errors.email.message}</p>}
                </div>
                <div>
                    <label>Password</label>
                    <input type='password' {...register('password')} />
                    {errors.password && <p>{errors.password.message}</p>}
                </div>
                <button type='submit' disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
        </div>
    )
}
```

### `{...register('email')}` — spread operator

`register('email')` trả về một object gồm nhiều props React:
`{ name, ref, onChange, onBlur }`. Spread nó vào `<input>` gắn tất cả
cùng lúc. react-hook-form dùng `ref` để truy cập giá trị khi submit — không
lưu vào state React (đó là ý nghĩa "uncontrolled").

### `disabled={loading}` — chống double submit

Khi đang submit, button bị disable. Nếu không làm thế này, user bấm nhiều
lần → nhiều request song song → race condition (request sau về trước request
trước → state không nhất quán).

## `ChangePasswordPage.jsx` — Cross-field Validation với `.refine()`

```jsx
const schema = z.object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
})
```

`.refine()` là **cross-field validation** — validate quan hệ giữa các field
với nhau (không thể làm trong `.object()` vì mỗi field validate độc lập).
`path: ['confirmPassword']` chỉ định lỗi này gắn vào field `confirmPassword`,
không phải toàn form.

## `ForgotPasswordPage.jsx` — Conditional Render với Early Return

```jsx
if (sent) {
    return (
        <div>
            <h4>Check your email</h4>
            <p>If that address exists, a reset link has been sent.</p>
        </div>
    )
}

return (
    <div>
        <form>...</form>
    </div>
)
```

**Early return pattern** trong JSX: khi `sent = true`, return block thứ
nhất và dừng. Code không bao giờ tới `return` thứ 2. Đây là cách tránh
nested ternary phức tạp:

```jsx
// BAD — khó đọc
return sent ? <ThankYou /> : <Form />

// GOOD — rõ từng case
if (sent) return <ThankYou />
return <Form />
```

## `ResetPasswordPage.jsx` — Đọc Query Param từ URL

```jsx
const [searchParams] = useSearchParams()
const token = searchParams.get('token')

const onSubmit = ({ newPassword }) => {
    handleResetPassword({ token, newPassword })
}

if (!token) {
    return <p>Invalid reset link.</p>
}
```

`useSearchParams()` — hook của React Router để đọc query params trong URL.
URL dạng `/reset-password?token=8Mg63gL...` → `searchParams.get('token')` trả
về `'8Mg63gL...'`.

`onSubmit` là wrapper function vì cần **inject `token`** vào trước khi gọi
hook — form chỉ biết `{ newPassword, confirmPassword }`, không biết `token`
(token không phải field trong form, token đọc từ URL). Hook nhận cả 2:
`handleResetPassword({ token, newPassword })`.

Guard `if (!token)` hiện lỗi ngay thay vì để user điền form xong rồi mới
báo link invalid — UX tốt hơn.

## Lỗi thật đã gặp trong session này

| # | File | Lỗi | Sửa |
|---|------|-----|-----|
| 1 | LoginPage | `import { use } from 'react'` thừa và sai | Xóa dòng import |
| 2 | LoginPage | `error.email` thay vì `errors.email` (2 chỗ) | Đổi sang `errors` |
| 3 | ChangePasswordPage | `shcema` (typo tên biến) + line 24 dùng `schema` → ReferenceError | Đổi thành `schema` |
| 4 | ChangePasswordPage | `reqired` → `required` (typo string) | Sửa typo |
| 5 | ChangePasswordPage | `handleChanePassword` thiếu `g` (2 chỗ) | Sửa thành `handleChangePassword` |
| 6 | ForgotPasswordPage | `formState: { error }` thay vì `{ errors }` (shadow variable) | Đổi sang `errors` |
