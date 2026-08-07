# 03 — authApi.js: Tầng Giao Tiếp HTTP Thuần

## Vì sao tách `authApi.js` ra khỏi hook?

Nguyên tắc trong Series 2: mỗi tầng chỉ làm một việc.

```text
Page (LoginPage.jsx)     → chỉ render UI
Hook (useLogin.js)       → chỉ xử lý logic: state, try/catch, navigate
API (authApi.js)         → chỉ gọi HTTP, trả về Axios response
```

Nếu bỏ `authApi.js` và gọi `axiosClient.post(...)` thẳng trong hook:
- Hook và URL endpoint bị gắn chặt với nhau
- Muốn test hook mà không cần mock cả Axios sẽ khó hơn
- Muốn đổi endpoint thì phải tìm trong hook, không có chỗ tập trung

`authApi.js` giống "Repository" trong Clean Architecture — một lớp mỏng ánh
xạ 1-1 giữa hàm JS và HTTP endpoint. Không có state, không có React, không
có logic nghiệp vụ — chỉ gọi và trả về.

## Code cuối cùng — `frontend/src/api/authApi.js`

```js
import axiosClient from './axiosClient'

export function login(email, password) {
    return axiosClient.post('/api/auth/login/', { email, password })
}

export function logout(refreshToken) {
    return axiosClient.post('/api/auth/logout/', { refresh: refreshToken })
}

export function forgotPassword(email) {
    return axiosClient.post('/api/auth/forgot-password/', { email })
}

export function resetPassword(token, newPassword) {
    return axiosClient.post('/api/auth/reset-password/', {
        token,
        new_password: newPassword,
    })
}

export function changePassword(oldPassword, newPassword) {
    return axiosClient.post('/api/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
    })
}
```

## Lỗi thật đã gặp trong session này

### Lỗi 1 — `resetPassword` dùng nhầm `old_password`

Lần đầu viết `resetPassword(token, newPassword)` nhưng trong body gửi
`old_password` — nhầm với `changePassword`. Đây là 2 luồng khác nhau hoàn
toàn:

| Hàm | Ai gọi | Backend cần gì |
|---|---|---|
| `resetPassword` | Người dùng chưa đăng nhập, có token email | `{ token, new_password }` |
| `changePassword` | Người dùng đang đăng nhập, biết mật khẩu cũ | `{ old_password, new_password }` |

Sửa: `resetPassword` gửi `{ token, new_password }`, `changePassword` gửi
`{ old_password, new_password }`.

### Lỗi 2 — Bị cắt file, thiếu `changePassword`

Trong quá trình gõ, file bị lưu thiếu hàm cuối `changePassword`. Kết quả:
hook `useChangePassword` import hàm không tồn tại → runtime error khi gọi.
Luôn đọc lại file sau khi gõ để kiểm tra không bị cắt.

## Quy tắc đặt tên tham số

Các hàm trong `authApi.js` dùng camelCase (`oldPassword`, `newPassword`,
`refreshToken`) — đây là convention JavaScript. Nhưng key gửi lên server
dùng snake_case (`old_password`, `new_password`, `refresh`) vì đó là
convention Python/Django. Hai convention song song, phải nhớ chuyển đổi.
