# 02 — Axios Interceptor: Tự Gắn Token & Tự Refresh Khi 401

## Vấn đề cần giải quyết

Access token chỉ sống **15 phút**. Không có gì tự xử lý → sau 15 phút mọi
API call trả 401, user bị đẩy về trang login giữa chừng. Giải pháp: một
lớp "interceptor" nằm giữa mọi request/response, tự động:

1. Gắn `Bearer <token>` vào header **trước khi** request rời đi
2. Khi nhận 401, **tự xin token mới** bằng refresh token, rồi **thử lại**
   request ban đầu — người dùng không biết có chuyện gì xảy ra

So sánh với Java: interceptor giống `Filter` trong Spring Security hoặc
`HttpInterceptor` trong Angular — một lớp middleware nằm trước mọi request.

## Code cuối cùng — `frontend/src/api/axiosClient.js`

```js
import axios from 'axios'
import useAuthStore from '../stores/authStore'

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
})

// Interceptor 1: gắn token vào mọi request
axiosClient.interceptors.request.use((config) => {
    const { accessToken } = useAuthStore.getState()
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
})

// Interceptor 2: bắt 401, thử refresh, retry request gốc
axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true

            const { refreshToken, login, logout } = useAuthStore.getState()

            try {
                const res = await axios.post(
                    `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh/`,
                    { refresh: refreshToken }
                )

                const newAccessToken = res.data.access
                login(newAccessToken, refreshToken, useAuthStore.getState().user)

                original.headers.Authorization = `Bearer ${newAccessToken}`
                return axiosClient(original)
            } catch {
                logout()
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default axiosClient
```

## Giải thích từng phần quan trọng

### `axios.create({...})` — vì sao không dùng `axios` trực tiếp?

`axios.create()` tạo một **instance riêng** với cấu hình mặc định (baseURL,
headers). Lợi ích: mọi nơi trong app chỉ cần import `axiosClient` là tự
động có đúng baseURL và header — không cần lặp lại mỗi lần gọi. Interceptor
đăng ký trên instance này cũng chỉ áp dụng cho instance đó, không ảnh hưởng
tới `axios` gốc.

### `import.meta.env.VITE_API_BASE_URL` — đọc biến môi trường trong Vite

Vite (build tool của dự án) đọc file `.env` và inject các biến bắt đầu
bằng `VITE_` vào `import.meta.env`. Ở đây: `VITE_API_BASE_URL=http://localhost:8000`
→ thay bằng URL production sau khi deploy. Không hardcode URL trực tiếp
trong code vì mỗi môi trường (dev/staging/prod) có URL khác nhau.

### `useAuthStore.getState()` — vì sao không dùng hook?

Interceptor là một hàm callback thông thường, **không phải React component**.
React hooks chỉ được gọi trong component hoặc custom hook — ngoài đó React
báo lỗi. `useAuthStore.getState()` là cách Zustand cung cấp để đọc state
từ bất kỳ đâu mà không cần React context.

### `original._retry` — lá cờ ngăn vòng lặp vô tận

Đây là điểm quan trọng nhất trong interceptor. Xem xét điều gì xảy ra
nếu không có flag này:

```text
1. Request thất bại 401
2. Interceptor chạy, gọi refresh
3. Refresh cũng thất bại (refresh token hết hạn) → trả về 401
4. Interceptor bắt 401 MỚI NÀY, gọi refresh lại
5. Lại thất bại, lại bắt 401 ...
→ Vòng lặp vô tận, crash browser
```

`original._retry = true` đánh dấu "request này đã được retry 1 lần rồi".
Khi interceptor nhận 401 tiếp theo, điều kiện `!original._retry` là `false`
→ skip interceptor → để lỗi đi qua bình thường.

### Vì sao dùng `axios.post(...)` thuần cho refresh, không dùng `axiosClient`?

```js
// SAI — gọi axiosClient để refresh sẽ trigger chính interceptor này
const res = await axiosClient.post('/api/auth/refresh/', ...)

// ĐÚNG — dùng axios gốc, không có interceptor
const res = await axios.post(`${baseURL}/api/auth/refresh/`, ...)
```

Nếu dùng `axiosClient` để gọi refresh, request đó cũng đi qua interceptor.
Nếu refresh thất bại (401), interceptor lại cố refresh... vòng lặp vô tận
một lần nữa, dù có `_retry` flag.

### `res.data.access` — không phải `res.data.accessToken`

Django SimpleJWT trả về key tên là `access`, không phải `accessToken`.
Đây là bug đã gặp và sửa trong session này. Phải đọc kỹ response của
backend, không đoán tên key.

### `window.location.href = '/login'` — vì sao không dùng `useNavigate()`?

`useNavigate()` là hook của React Router — chỉ dùng được trong component.
Interceptor là file JS thuần → dùng `window.location.href` (native browser
API). Cách này reload trang, làm sạch toàn bộ RAM state (đúng ý muốn: user
phải đăng nhập lại từ đầu).

## Luồng xử lý đầy đủ

```text
Component gọi axiosClient.get('/api/...')
    ↓
[Interceptor request] → gắn Authorization: Bearer <accessToken>
    ↓
Server nhận request
    ↓ (token còn hạn)
200 OK → response đến component bình thường
    ↓ (token hết hạn)
401 Unauthorized
    ↓
[Interceptor response] bắt lỗi 401
    → đặt original._retry = true
    → gọi POST /api/auth/refresh/ (dùng axios gốc, không qua interceptor)
        ↓ (refresh thành công)
        → lưu newAccessToken vào Zustand
        → gắn token mới vào original.headers
        → gọi lại axiosClient(original)
        → 200 OK → component nhận data (không biết có chuyện gì)
        ↓ (refresh thất bại — token hết hạn hoặc bị blacklist)
        → logout() (xóa state Zustand)
        → window.location.href = '/login'
```
