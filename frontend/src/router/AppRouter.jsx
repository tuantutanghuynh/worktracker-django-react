import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "./ProtectedRoute"
import { useAuth } from "../hooks/useAuth"

// Pages thuộc Auth (dùng chung mọi role)
import { LoginPage } from "../pages/auth/LoginPage"
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage"
import { ChangePasswordPage } from "../pages/auth/ChangePasswordPage"

// Employee (nhóm Tú)
import { EmployeeLayout } from "../layouts/EmployeeLayout"
import { ProfilePage } from "../pages/employee/ProfilePage"
import { DashboardPage } from "../pages/employee/DashboardPage"
import { MyPerformancePage } from "../pages/employee/MyPerformancePage"
import { NotificationsPage } from "../pages/employee/NotificationsPage"
import { MyTasksPage } from "../pages/employee/MyTasksPage"
import { TimesheetPage } from "../pages/employee/TimesheetPage"



// Manager (Long) — lazy load, chỉ tải khi thật sự vào /manager/*
import ManagerLayout from "../layouts/ManagerLayout"
const ManagerDashboardPage = lazy(() => import("../pages/manager/ManagerDashboardPage"))
const ManagerJobsPage = lazy(() => import("../pages/manager/ManagerJobsPage"))
const ManagerJobDetailPage = lazy(() => import("../pages/manager/ManagerJobDetailPage"))
const ManagerKanbanPage = lazy(() => import("../pages/manager/ManagerKanbanPage"))
const ManagerTeamPage = lazy(() => import("../pages/manager/ManagerTeamPage"))
const ManagerTimesheetReviewPage = lazy(() => import("../pages/manager/ManagerTimesheetReviewPage"))
const ManagerTimeLockPage = lazy(() => import("../pages/manager/ManagerTimeLockPage"))
const ManagerReportsPage = lazy(() => import("../pages/manager/ManagerReportsPage"))
const ManagerNotificationsPage = lazy(() => import("../pages/manager/ManagerNotificationsPage"))
const ManagerChatPage = lazy(() => import("../pages/manager/ManagerChatPage"))
const ManagerProfilePage = lazy(() => import("../pages/manager/ManagerProfilePage"))
const ManagerSettingsPage = lazy(() => import("../pages/manager/ManagerSettingsPage"))

// Admin (Minh Anh) — lazy load, chỉ tải khi thật sự vào /admin/*.
// Chỉ nối tạm trên nhánh nháp draft-merge-tuantu-minhanh để thử chạy,
// không phải quyết định merge chính thức.
import AdminLayout from "../layouts/AdminLayout"
const AdminDashboardPage = lazy(() => import("../pages/admin/DashboardPage").then((m) => ({ default: m.DashboardPage })))
const AdminClientsPage = lazy(() => import("../pages/admin/ClientsPage").then((m) => ({ default: m.ClientsPage })))
const AdminDepartmentsPage = lazy(() => import("../pages/admin/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage })))
const AdminCreateUserPage = lazy(() => import("../pages/admin/CreateUserPage").then((m) => ({ default: m.CreateUserPage })))
const AdminSearchUserPage = lazy(() => import("../pages/admin/SearchUserPage").then((m) => ({ default: m.SearchUserPage })))
const AdminJobsPage = lazy(() => import("../pages/admin/JobsPage").then((m) => ({ default: m.JobsPage })))
const AdminAuditLogsPage = lazy(() => import("../pages/admin/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage })))
const AdminTimesheetControlPage = lazy(() => import("../pages/admin/TimesheetControlPage").then((m) => ({ default: m.TimesheetControlPage })))
const AdminNotificationsPage = lazy(() => import("../pages/admin/NotificationsPage").then((m) => ({ default: m.NotificationsPage })))

function PageLoadingSpinner() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Loading App...</p>
            </div>
        </div>
    )
}

// "/" no longer has one right destination now that both Employee and
// Manager portals exist — send each role to its own dashboard instead
// of hardcoding either. Employee renders DashboardPage directly (no
// extra redirect hop); Manager/Admin get redirected to /manager/dashboard.
function RoleHome() {
    const { user } = useAuth()
    const role = (user?.role || "").toUpperCase()
    if (role === "ADMIN") {
        return <Navigate to="/admin" replace />
    }
    if (role === "MANAGER") {
        return <Navigate to="/manager/dashboard" replace />
    }
    return <DashboardPage />
}

// Single place declaring every route in the app. Public routes (login,
// forgot/reset password) sit outside ProtectedRoute; everything else —
// including change-password, which needs an authenticated request — is
// nested inside it so unauthenticated users get redirected automatically.

// Builds the full route tree for the app.
export function AppRouter() {
    return (
        <BrowserRouter>
            <Suspense fallback={<PageLoadingSpinner />}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    <Route element={<ProtectedRoute />}>
                        <Route path="/change-password" element={<ChangePasswordPage />} />

                        <Route element={<EmployeeLayout />}>
                            <Route path="/" element={<RoleHome />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            {/* Sidebar's EMPLOYEE nav config (pulled from LongNguyen) links
                                under /employee/*, not the flat paths above — alias the pages
                                that exist so those nav items resolve instead of hitting the
                                catch-all redirect. All of Phase 3's nav items (my-tasks,
                                timesheet, my-performance, notifications) now have a page. */}
                            <Route path="/employee/dashboard" element={<DashboardPage />} />
                            <Route path="/employee/profile" element={<ProfilePage />} />
                            <Route path="/my-performance" element={<MyPerformancePage />} />
                            <Route path="/employee/my-performance" element={<MyPerformancePage />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/employee/notifications" element={<NotificationsPage />} />
                            <Route path="/my-tasks" element={<MyTasksPage />} />
                            <Route path="/employee/my-tasks" element={<MyTasksPage />} />
                            <Route path="/employee/timesheet" element={<TimesheetPage />} />

                        </Route>

                        <Route element={<ProtectedRoute allowedRoles={["MANAGER", "ADMIN"]} />}>
                            <Route path="/manager" element={<ManagerLayout />}>
                                <Route index element={<Navigate to="/manager/dashboard" replace />} />
                                <Route path="dashboard" element={<ManagerDashboardPage />} />
                                <Route path="jobs" element={<ManagerJobsPage />} />
                                <Route path="jobs/:id" element={<ManagerJobDetailPage />} />
                                <Route path="jobs/:jobId/kanban" element={<ManagerKanbanPage />} />
                                <Route path="kanban" element={<ManagerKanbanPage />} />
                                <Route path="team" element={<ManagerTeamPage />} />
                                <Route path="timesheet" element={<ManagerTimesheetReviewPage />} />
                                <Route path="timesheets/review" element={<ManagerTimesheetReviewPage />} />
                                <Route path="timelock" element={<ManagerTimeLockPage />} />
                                <Route path="timelocks" element={<ManagerTimeLockPage />} />
                                <Route path="reports" element={<ManagerReportsPage />} />
                                <Route path="chat" element={<ManagerChatPage />} />
                                <Route path="notifications" element={<ManagerNotificationsPage />} />
                                <Route path="profile" element={<ManagerProfilePage />} />
                                <Route path="settings" element={<ManagerSettingsPage />} />
                            </Route>
                        </Route>

                        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                            <Route path="/admin" element={<AdminLayout />}>
                                <Route index element={<AdminDashboardPage />} />
                                <Route path="clients" element={<AdminClientsPage />} />
                                <Route path="departments" element={<AdminDepartmentsPage />} />
                                <Route path="users/create" element={<AdminCreateUserPage />} />
                                <Route path="users/search" element={<AdminSearchUserPage />} />
                                <Route path="jobs" element={<AdminJobsPage />} />
                                <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                                <Route path="timesheets" element={<AdminTimesheetControlPage />} />
                                <Route path="notifications" element={<AdminNotificationsPage />} />
                                {/* Self-service profile is role-agnostic on the backend
                                    (accounts/employee/views_employee.py uses IsAuthenticated),
                                    so Admin reuses Tú's page as-is instead of a duplicate. */}
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    )
}
