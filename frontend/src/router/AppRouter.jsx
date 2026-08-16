import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "./ProtectedRoute"
import { LoginPage } from "../pages/auth/LoginPage"
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage"
import { ChangePasswordPage } from "../pages/auth/ChangePasswordPage"
import { EmployeeLayout } from "../layouts/EmployeeLayout"
import { ProfilePage } from "../pages/employee/ProfilePage"

// Single place declaring every route in the app. Public routes (login,
// forgot/reset password) sit outside ProtectedRoute; everything else —
// including change-password, which needs an authenticated request — is
// nested inside it so unauthenticated users get redirected automatically.

// Builds the full route tree for the app.
export function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                <Route element={<ProtectedRoute />}>
                    <Route path="/change-password" element={<ChangePasswordPage />} />

                    <Route element={<EmployeeLayout />}>
                        {/* TODO Phase 3: thay bằng Dashboard/My Tasks/Timesheet... thật */}
                        <Route path="/" element={<div>Employee Dashboard (Phase 3)</div>} />
                        <Route path="/profile" element={<ProfilePage />} />
                        {/* Sidebar's EMPLOYEE nav config (pulled from LongNguyen) links
                            under /employee/*, not the flat paths above — alias profile
                            so that nav item resolves instead of hitting the catch-all
                            redirect. Other /employee/* nav items (dashboard, my-tasks,
                            timesheet, my-performance, notifications) still 404 → home
                            until Phase 3 builds those pages. */}
                        <Route path="/employee/profile" element={<ProfilePage />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
