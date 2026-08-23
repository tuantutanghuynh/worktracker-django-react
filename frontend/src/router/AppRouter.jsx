import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "./ProtectedRoute"
import { RoleRoute } from "./RoleRoute"
import { ROUTES } from "../constants/routes"
import { LoginPage } from "../pages/auth/LoginPage"
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage"
import { ChangePasswordPage } from "../pages/auth/ChangePasswordPage"
import AdminLayout from "../layouts/AdminLayout"
import { DepartmentsPage } from "../pages/admin/DepartmentsPage"
import { CreateUserPage } from "../pages/admin/CreateUserPage"
import { SearchUserPage } from "../pages/admin/SearchUserPage"
import { JobsPage } from "../pages/admin/JobsPage"
import { ClientsPage } from "../pages/admin/ClientsPage"
import { AuditLogsPage } from "../pages/admin/AuditLogsPage"
import { DashboardPage } from "../pages/admin/DashboardPage"
import { NotificationsPage } from "../pages/admin/NotificationsPage"

export function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
                <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />

                <Route element={<ProtectedRoute />}>
                    <Route path={ROUTES.CHANGE_PASSWORD} element={<ChangePasswordPage />} />

                    <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
                        <Route path="/admin" element={<AdminLayout />}>
                            <Route index element={<DashboardPage />} />
                            <Route path="clients" element={<ClientsPage />} />
                            <Route path="departments" element={<DepartmentsPage />} />
                            <Route path="users/create" element={<CreateUserPage />} />
                            <Route path="users/search" element={<SearchUserPage />} />
                            <Route path="jobs" element={<JobsPage />} />
                            <Route path="audit-logs" element={<AuditLogsPage />} />
                            <Route path="notifications" element={<NotificationsPage />} />
                        </Route>
                    </Route>

                    {/* TODO Phase 3: thay bằng Dashboard/My Tasks/Timesheet... thật */}
                    <Route path="/" element={<div>Employee Dashboard (Phase 3)</div>} />
                </Route>

                <Route path={ROUTES.UNAUTHORIZED} element={<div>403 — Unauthorized</div>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
