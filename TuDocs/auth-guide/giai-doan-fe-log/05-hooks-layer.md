# 05 — Hooks Layer: useAuth, useLogin, useChangePassword, useForgotPassword, useResetPassword

## Vị trí của hooks trong kiến trúc

```text
Page (chỉ render UI)
   ↓ gọi
Hook (state + logic + navigate)
   ↓ gọi
authApi.js (HTTP call)
   ↓ gọi
Backend
```

Hook là "bộ não" của từng luồng nghiệp vụ. Page không biết gì về API,
state, hay navigate — chỉ nhận về `{ loading, error, handleXxx }` từ hook
rồi gắn vào JSX. Đây là lý do page luôn rất ngắn và dễ đọc.

---

## `useAuth.js` — Public Interface duy nhất

```js
import useAuthStore from '../stores/authStore'
import { logout as logoutAPI } from '../api/authApi'

export default function useAuth() {
    const { accessToken, refreshToken, user, login, logout, setUser } = useAuthStore()

    const signOut = async () => {
        try {
            await logoutAPI(refreshToken)
        } finally {
            logout()
        }
    }

    return {
        user,
        accessToken,
        isLoggedIn: Boolean(accessToken),
        login,
        logout: signOut,
        setUser,
    }
}
```

### Vì sao cần `useAuth` bọc ngoài `useAuthStore`?

Đây là **nguyên tắc ẩn implementation** (information hiding). Tất cả component
trong app chỉ `import useAuth` — không ai biết bên trong dùng Zustand hay
Redux hay Context. Nếu sau này đổi thư viện state management, chỉ sửa
`useAuth.js`, không đụng tới 20 component khác.

Ngoài ra, `useAuth` thêm logic vào hàm `logout`: gọi backend blacklist
endpoint **trước khi** xóa state local. Nếu gọi Zustand `logout()` trực
tiếp từ component, không có chỗ để thêm logic này.

### Vì sao dùng `finally` trong `signOut`?

```js
const signOut = async () => {
    try {
        await logoutAPI(refreshToken)   // Gọi /api/auth/logout/ để blacklist token
    } finally {
        logout()                         // Xóa state local DÙ API thành công hay thất bại
    }
}
```

Nếu backend đang down hoặc mạng lỗi, `logoutAPI` sẽ ném exception. Nếu
dùng `catch` thay vì `finally`, có nguy cơ `logout()` không được gọi → user
vẫn ở trạng thái "đã login" dù muốn đăng xuất. `finally` đảm bảo local
state **luôn được xóa** bất kể chuyện gì xảy ra với API.

### `isLoggedIn: Boolean(accessToken)`

`Boolean(null) = false`, `Boolean('eyJ...') = true`. Đây là cách ngắn gọn
chuyển từ "có token không" sang boolean `true/false` mà component dùng được.

---

## `useLogin.js` — Xử lý Đăng Nhập

```js
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/authApi'
import useAuth from './useAuth'
import { ROUTES, ROLE_DASHBOARD } from '../constants/routes'

const getErrorMessage = (err) =>
    err.response?.data?.detail ??
    err.response?.data?.message ??
    'Invalid email or password'

export default function useLogin() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { login: storeLogin } = useAuth()
    const navigate = useNavigate()

    const redirectAfterLogin = (user) => {
        if (user.must_change_password) {
            navigate(ROUTES.CHANGE_PASSWORD)
            return
        }
        navigate(ROLE_DASHBOARD[user.role] ?? ROLE_DASHBOARD.EMPLOYEE)
    }

    /** Authenticate user and redirect after successful login. */
    const handleLogin = async ({ email, password }) => {
        setError('')
        setLoading(true)
        try {
            const res = await login(email, password)
            const { access, refresh, user } = res.data
            storeLogin(access, refresh, user)
            redirectAfterLogin(user)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return { handleLogin, loading, error }
}
```

### Vì sao tách `redirectAfterLogin` ra hàm riêng?

`handleLogin` làm 3 việc: gọi API, lưu state, redirect. Quá nhiều trách
nhiệm trong 1 hàm. Tách `redirectAfterLogin` ra giúp:
- Đọc `handleLogin` dễ hiểu hơn (từng bước rõ ràng)
- `redirectAfterLogin` có thể test độc lập nếu cần

### `login: storeLogin` — destructure với alias

```js
const { login: storeLogin } = useAuth()
```

`useAuth` xuất hàm tên `login` — nhưng tên đó trùng với hàm `login` đã
import từ `authApi`. Dùng alias `storeLogin` để phân biệt 2 hàm:
- `login(email, password)` = gọi HTTP API
- `storeLogin(access, refresh, user)` = lưu vào Zustand

### `?? ROLE_DASHBOARD.EMPLOYEE` — Nullish Coalescing

`ROLE_DASHBOARD[user.role]` trả về `/admin`, `/manager`, `/emp`. Nếu
`user.role` là giá trị không có trong object (ví dụ `null`) → trả về
`undefined` → `??` fallback về `ROLE_DASHBOARD.EMPLOYEE` (`'/emp'`).
Tránh redirect về `undefined` gây lỗi.

### `getErrorMessage` — Vì sao cần helper riêng?

```js
const getErrorMessage = (err) =>
    err.response?.data?.detail ??
    err.response?.data?.message ??
    'Invalid email or password'
```

Django có thể trả lỗi theo nhiều format:
- `{ detail: "Invalid email or password." }` — lỗi từ `raise AuthenticationFailed`
- `{ message: "..." }` — một số endpoint khác
- Không có response gì (mạng lỗi, CORS fail) → fallback

Tách ra helper giúp dễ đổi sau này (thêm format mới) mà không sửa trong
`handleLogin`.

---

## `useChangePassword.js` — Đổi Mật Khẩu Bắt Buộc

```js
export default function useChangePassword() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { user, setUser } = useAuth()
    const navigate = useNavigate()

    const handleChangePassword = async ({ oldPassword, newPassword }) => {
        setError('')
        setLoading(true)
        try {
            await changePassword(oldPassword, newPassword)
            setUser({ ...user, must_change_password: false })
            navigate(ROLE_DASHBOARD[user.role] ?? ROLE_DASHBOARD.EMPLOYEE)
        } catch (err) {
            setError(
                err.response?.data?.old_password?.[0] ??
                err.response?.data?.detail ??
                'Failed to change password'
            )
        } finally {
            setLoading(false)
        }
    }

    return { handleChangePassword, loading, error }
}
```

### `setUser({ ...user, must_change_password: false })`

Sau khi đổi mật khẩu thành công, backend không trả về user object mới.
Cần tự cập nhật state trong Zustand: spread `...user` để giữ nguyên mọi
field (`id`, `email`, `role`...), chỉ override `must_change_password: false`.
Nếu không làm bước này, `ProtectedRoute` vẫn thấy `must_change_password=true`
và redirect về `/change-password` dù đã đổi xong.

### `err.response?.data?.old_password?.[0]` — Parse lỗi Django field-level

Django REST Framework khi validate lỗi một field cụ thể (ví dụ sai
`old_password`) trả về dạng:
```json
{ "old_password": ["Wrong password."] }
```
Là **array of strings**, không phải string đơn lẻ. `?.[0]` lấy phần tử
đầu tiên. Khác với lỗi toàn form (`detail`) là string.

---

## `useForgotPassword.js`

```js
export default function useForgotPassword() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [sent, setSent] = useState(false)

    const handleForgotPassword = async ({ email }) => {
        setError('')
        setLoading(true)
        try {
            await forgotPassword(email)
            setSent(true)
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Failed to send reset email')
        } finally {
            setLoading(false)
        }
    }

    return { handleForgotPassword, loading, error, sent }
}
```

### Vì sao trả thêm `sent` state? Vì sao không redirect?

`sent` cho phép page **thay form bằng thông báo xác nhận** ngay trên cùng
trang — không redirect. Lý do: người dùng cần đọc hướng dẫn "kiểm tra email
của bạn" trên trang hiện tại. Nếu redirect về trang khác ngay, họ có thể
bỏ lỡ thông báo. Đây là UX pattern phổ biến cho forgot password.

---

## `useResetPassword.js`

```js
export default function useResetPassword() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()

    const handleResetPassword = async ({ token, newPassword }) => {
        setError('')
        setLoading(true)
        try {
            await resetPassword(token, newPassword)
            navigate(ROUTES.LOGIN)
        } catch (err) {
            setError(
                err.response?.data?.detail ??
                err.response?.data?.token?.[0] ??
                'Invalid or expired reset link'
            )
        } finally {
            setLoading(false)
        }
    }

    return { handleResetPassword, loading, error }
}
```

### Vì sao hook không tự đọc `token` từ URL?

`token` được truyền vào từ page (`ResetPasswordPage`) — page đọc từ URL
query param (`?token=xxx`). Hook không tự đọc URL vì:

1. Hook nên tập trung vào logic API, không phải đọc URL
2. Tách rời giúp test hook độc lập mà không cần mock React Router

Page chịu trách nhiệm lấy `token`, hook chịu trách nhiệm gọi API.
