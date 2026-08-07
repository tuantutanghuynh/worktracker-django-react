# 01 — Zustand Store: State Toàn Cục cho Auth

## Vấn đề cần giải quyết — vì sao không dùng `useState` thông thường

Thông tin "ai đang đăng nhập, role gì, token gì" cần được đọc ở **nhiều
nơi rất khác nhau** trong app cùng lúc:

- `ProtectedRoute` cần biết "đã login chưa" để quyết định redirect
- Axios interceptor cần đọc `accessToken` để gắn vào mọi request
- Header/Sidebar cần hiển thị tên user, role
- Sau khi refresh token thành công, cần lưu lại `accessToken` mới

Nếu dùng `useState` ở component cha rồi truyền props xuống, bạn sẽ gặp
**"prop drilling"**: truyền qua 5-6 tầng component chỉ để token tới được
chỗ cần. Zustand giải quyết bằng cách đặt state **hoàn toàn bên ngoài**
cây component — bất kỳ file nào cũng gọi được, kể cả file JS thuần không
phải React.

So sánh với Java: Zustand tương tự một `Singleton` giữ application state,
nhưng bất cứ component nào "subscribe" vào thì tự động re-render khi state
thay đổi — không cần observer pattern tự viết.

## Vì sao không dùng `localStorage` để lưu token

```text
localStorage → tồn tại kể cả khi đóng tab → XSS script đọc được
RAM (Zustand) → mất khi reload trang → XSS script không đọc được
```

**XSS (Cross-Site Scripting)**: nếu một trang web cho phép kẻ tấn công
chèn script độc vào, script đó chạy trong cùng origin và đọc được
`localStorage`. Token trong `localStorage` = token bị lộ = kẻ tấn công
đăng nhập được bằng token đó từ máy khác.

Với RAM: script XSS vẫn có thể đọc được token trong bộ nhớ trong lúc
session đang chạy — đây vẫn là rủi ro. Nhưng khi người dùng đóng tab
hoặc reload, token biến mất hoàn toàn, kẻ tấn công không thể tái sử dụng.

**Đánh đổi có chủ đích**: người dùng phải đăng nhập lại mỗi khi reload
trang. Với WorkTracker (app nội bộ, phiên làm việc trong giờ hành chính),
đây là đánh đổi chấp nhận được để đổi lấy bảo mật tốt hơn.

## Code cuối cùng — `frontend/src/stores/authStore.js`

```js
import { create } from 'zustand';

const useAuthStore = create((set) => ({
    accessToken: null,
    refreshToken: null,
    user: null,

    setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
    setUser: (user) => set({ user }),
    login: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
    logout: () => set({ accessToken: null, refreshToken: null, user: null }),
}))

export default useAuthStore
```

## Giải thích từng phần

### `create((set) => ({...}))`

`create` là hàm của Zustand. Bạn truyền vào một function nhận `set` —
`set` là hàm dùng để **cập nhật state**, giống `setState` trong React nhưng
không cần ở trong component. Khi bạn gọi `set({ accessToken: 'abc' })`,
Zustand tự động:
1. Merge giá trị mới vào state hiện tại (không cần spread `...state` như Redux)
2. Thông báo cho mọi component đang "subscribe" → trigger re-render

### Vì sao có cả `login` lẫn `setTokens` + `setUser` riêng?

- `login()` — dùng ngay sau khi nhận response từ API đăng nhập: set cả 3
  field cùng lúc trong 1 lần gọi
- `setUser()` — dùng sau khi đổi mật khẩu thành công: chỉ cần cập nhật
  `must_change_password: false` trong user object mà không đụng tới token

### Vì sao `logout()` set về `null` thay vì xóa key?

Zustand dùng `null` để đại diện "chưa có giá trị" — giữ nguyên cấu trúc
state nhất quán. Nếu xóa key đi, code đọc `state.accessToken` có thể nhận
`undefined` thay vì `null` — khó debug hơn. Với `null`, `Boolean(null) = false`
hoạt động đúng trong mọi điều kiện.

## Cách đọc store — 2 tình huống khác nhau

### Trong React component (dùng hook):

```js
// Đúng — hook tự động re-render component khi state thay đổi
const { user, login } = useAuthStore()
```

### Ngoài React (file JS thuần, interceptor Axios):

```js
// Đúng — đọc snapshot state tại thời điểm đó, không trigger re-render
const { accessToken } = useAuthStore.getState()
```

Axios interceptor không phải React component — không thể dùng hook ở đó
(React sẽ báo lỗi "hook called outside component"). `getState()` là cách
Zustand cho phép đọc state từ bất kỳ đâu mà không cần hook.

## Nguyên tắc quan trọng: không import store trực tiếp vào component

```js
// SAI — component phụ thuộc trực tiếp vào Zustand
import useAuthStore from '../stores/authStore'
const { user } = useAuthStore()

// ĐÚNG — component chỉ biết đến useAuth (public interface)
import useAuth from '../hooks/useAuth'
const { user } = useAuth()
```

`useAuth` là lớp bọc ngoài ẩn đi chi tiết implement. Nếu sau này đổi từ
Zustand sang Context hay Redux, chỉ cần sửa `useAuth.js` — mọi component
không cần đổi. Chi tiết ở file 05.
