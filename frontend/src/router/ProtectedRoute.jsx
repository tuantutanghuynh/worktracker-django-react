import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute({ allowedRoles = ['MANAGER', 'ADMIN'] }) {
    // Lấy trực tiếp từ Zustand Store
    const { accessToken, user } = useAuthStore();
    const userRole = (user?.role || '').toUpperCase();

    // 1. Chưa có Token (Chưa đăng nhập) -> Đẩy ngay về /login
    if (!accessToken) {
        return <Navigate to="/login" replace />;
    }

    // 2. Nếu có quy định allowedRoles và Role tài khoản không phù hợp -> Đẩy về trang chủ /
    if (allowedRoles.length > 0 && userRole && !allowedRoles.includes(userRole)) {
        return <Navigate to="/" replace />;
    }

    // 3. Đúng quyền và đã đăng nhập -> Cho phép truy cập vào các Route con
    return <Outlet />;
}

// Export cả 2 kiểu (Named & Default) để hỗ trợ 100% các kiểu import khác nhau
export default ProtectedRoute;