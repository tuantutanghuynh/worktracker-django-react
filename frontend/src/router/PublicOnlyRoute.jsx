import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

// Ngược chiều với ProtectedRoute: chặn 1 người ĐÃ đăng nhập truy cập
// các trang chỉ dành cho khách (login/forgot-password/reset-password).
//
// Bug thật đã tìm ra: không có guard này, ai đang đăng nhập tài khoản
// A vẫn gõ thẳng được /login, thấy form Login bình thường, và đăng
// nhập đè sang tài khoản B — accessToken/refreshToken của A bị Zustand
// ghi đè âm thầm trong authStore, KHÔNG đi qua logout() nên KHÔNG bị
// blacklist ở backend (refresh token của A vẫn "sống" hợp lệ tới khi
// tự hết hạn tự nhiên, tối đa 7 ngày) — session của A bị bỏ lửng thay
// vì bị đóng đúng cách.
export function PublicOnlyRoute() {
    const { isLoggedIn } = useAuth()

    if (isLoggedIn) {
        return <Navigate to="/" replace />
    }

    return <Outlet />
}
