# 07 — Kiến trúc Auth phía React (Frontend)

Backend chỉ là một nửa câu chuyện. Token sinh ra ở Django vô dụng nếu
Frontend không tổ chức tốt cách lưu, gửi kèm, và phản ứng khi token hết hạn.
Phần này dành để bạn hiểu **vai trò của từng khối** trước khi cả team bắt
tay code React.

## Global State: vì sao cần Zustand, không chỉ dùng `useState`

Thông tin "ai đang đăng nhập, role gì, token gì" cần được đọc ở **rất nhiều
component khác nhau** cùng lúc: Header (hiện tên user), Sidebar (ẩn/hiện menu
theo role), mọi page cần token để gọi API, ProtectedRoute cần biết "đã login
chưa". Nếu dùng `useState` ở component cha rồi truyền props xuống, bạn sẽ
gặp "prop drilling" (truyền qua nhiều tầng component không liên quan chỉ để
tới được component cần). Zustand là một state nằm "bên ngoài" cây component,
bất kỳ đâu cũng gọi được:

```text
useAuthStore = {
    user: { id, email, role },
    accessToken: "...",
    refreshToken: "...",
    isAuthenticated: () => !!accessToken,
    login: (data) => set({...}),
    logout: () => set({ user: null, accessToken: null, ... }),
}
```

Tài liệu yêu cầu chọn Zustand thay vì Redux vì *"nhẹ và nhanh hơn Redux"* —
với quy mô của 1 dự án nội bộ (không cần Redux DevTools phức tạp, time-travel
debugging), Zustand đủ dùng với code ít hơn nhiều.

## 3 lớp Route Guard — vì sao cần tách riêng 3 loại

Tài liệu liệt kê 3 component riêng biệt:

```jsx
<ProtectedRoute />
<RoleRoute role="ADMIN" />
<PermissionRoute permission="task:create" />
```

Đây không phải 3 cách làm cùng một việc — mỗi lớp trả lời một câu hỏi khác
nhau, xếp theo thứ tự từ lỏng tới chặt:

| Component | Câu hỏi | Ví dụ áp dụng |
|---|---|---|
| `ProtectedRoute` | Đã đăng nhập chưa? | Mọi trang trừ `/login`, `/forgot-password` |
| `RoleRoute` | Có đúng role yêu cầu không? | `/admin/*` chỉ ADMIN vào được |
| `PermissionRoute` | Có permission cụ thể không? | Nút "Tạo Client" chỉ hiện nếu có `client:create` |

`RoleRoute` thường đủ dùng cho việc chặn **cả một khu vực** (toàn bộ
`/admin/*`). `PermissionRoute` dùng cho việc chặn **chi tiết hơn trong cùng
một trang** — ví dụ Manager và Employee cùng vào được trang Task, nhưng nút
"Reject Task" chỉ Manager (có permission `task:review`) mới thấy.

**Nhắc lại nguyên tắc đã nói ở file 04**: các Route Guard này chỉ là UX (ẩn
nút, chặn điều hướng) — **không phải bảo mật thật**. Bảo mật thật vẫn phải
nằm ở Backend (permission check + data isolation). Nếu Frontend ẩn nút "Xóa
User" nhưng Backend không tự chặn, một người dùng rành kỹ thuật vẫn gọi được
API xóa qua DevTools/Postman.

## Axios Interceptor — tự động refresh token, vì sao cần

Access token chỉ sống 15 phút. Nếu không có gì xử lý, sau 15 phút mọi API
call sẽ trả 401 và buộc user đăng nhập lại — rất khó chịu khi đang làm việc
giữa chừng. Giải pháp: một "interceptor" (lớp chặn ở giữa, trước khi response
trả về component) tự động bắt lỗi 401, xin access token mới bằng refresh
token, rồi **lặp lại request ban đầu** mà người dùng không hề biết:

```text
Component gọi API (Axios) ──► 401 (access token hết hạn)
       ↓
Interceptor bắt lỗi 401
       ↓
Gọi POST /api/token/refresh/  (gửi refresh token)
       ↓
Nhận access token mới ──► lưu vào Zustand
       ↓
Gọi lại request ban đầu với access token mới
       ↓
Component nhận được data như bình thường, không biết có chuyện gì xảy ra
```

Trường hợp refresh token cũng hết hạn (sau 7 ngày không hoạt động) hoặc đã bị
blacklist (do logout/bị khóa tài khoản ở thiết bị khác) → interceptor không
refresh được nữa → lúc này mới thực sự logout và điều hướng về `/login`.

## jwt-decode — đọc payload phía client để làm gì

Sau khi login, Backend trả về `access` token và cả thông tin `user` riêng
(email, role...) trong response — vậy tại sao còn cần `jwt-decode` ở
Frontend? Hai lý do thực tế:

1. **Sau khi refresh token** (interceptor ở trên), Backend chỉ trả về access
   token mới, **không trả lại object `user`** — Frontend cần tự decode token
   để biết `role` có còn đúng như cũ không (phòng trường hợp Admin đổi role
   của user khi họ đang online).
2. **Kiểm tra hạn token phía client** trước khi gọi API, để quyết định có cần
   refresh trước hay không, tránh việc luôn phải đợi 1 request thất bại rồi
   mới refresh (trải nghiệm mượt hơn).

## Sơ đồ tổng hợp toàn bộ luồng Frontend

```text
App khởi động
   ↓
Đọc accessToken từ Zustand (persist từ localStorage)
   ↓
Có token? ──No──► ProtectedRoute redirect /login
   ↓ Yes
jwt-decode lấy role
   ↓
RoleRoute / PermissionRoute quyết định hiện gì
   ↓
Mọi API call qua Axios instance có interceptor:
   - Tự gắn header Authorization: Bearer <access>
   - Tự refresh khi 401
   - Tự logout khi refresh cũng fail
```

## Câu hỏi tự kiểm tra

1. Nếu 2 tab browser cùng mở app, một tab logout — tab còn lại có biết để
   logout theo không? (Gợi ý: đây là vấn đề đồng bộ state giữa các tab, không
   phải vấn đề của riêng JWT — nên biết để không bị bất ngờ khi test).
2. Vì sao `RoleRoute` và `PermissionRoute` không thể thay thế hoàn toàn cho
   permission check ở Backend, dù chúng giúp UX tốt hơn rất nhiều?
