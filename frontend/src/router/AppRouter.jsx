import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "./ProtectedRoute"
import { PublicOnlyRoute } from "./PublicOnlyRoute"
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
import { EmployeeChatPage } from "../pages/employee/EmployeeChatPage"
import { EmployeeAuditLogsPage } from "../pages/employee/EmployeeAuditLogsPage"
import MyTeamPage from "../pages/employee/MyTeamPage"

// Manager (Long) — lazy load
import ManagerLayout from "../layouts/ManagerLayout"
const ManagerDashboardPage = lazy(() => import("../pages/manager/ManagerDashboardPage"))
const ManagerJobsPage = lazy(() => import("../pages/manager/ManagerJobsPage"))
const ManagerJobDetailPage = lazy(() => import("../pages/manager/ManagerJobDetailPage"))
const ManagerKanbanPage = lazy(() => import("../pages/manager/ManagerKanbanPage"))
const ManagerTeamPage = lazy(() => import("../pages/manager/ManagerTeamPage"))
const ManagerTimesheetReviewPage = lazy(() => import("../pages/manager/ManagerTimesheetReviewPage"))
const ManagerTaskReviewPage = lazy(() => import("../pages/manager/ManagerTaskReviewPage"))
const ManagerTimeLockPage = lazy(() => import("../pages/manager/ManagerTimeLockPage"))
const ManagerReportsPage = lazy(() => import("../pages/manager/ManagerReportsPage"))
const ManagerNotificationsPage = lazy(() => import("../pages/manager/ManagerNotificationsPage"))
const ManagerChatPage = lazy(() => import("../pages/manager/ManagerChatPage"))
const ManagerProfilePage = lazy(() => import("../pages/manager/ManagerProfilePage"))
const ManagerAuditLogsPage = lazy(() => import("../pages/manager/ManagerAuditLogsPage"))

// Admin (Minh Anh) — lazy load
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

export function AppRouter() {
    return (
        <BrowserRouter>
            <Suspense fallback={<PageLoadingSpinner />}>
                <Routes>
                    <Route element={<PublicOnlyRoute />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                    </Route>

                    <Route element={<ProtectedRoute />}>
                        <Route path="/change-password" element={<ChangePasswordPage />} />

                        {/* Phân hệ EMPLOYEE */}
                        <Route element={<EmployeeLayout />}>
                            {/* "/" ở NGOÀI chốt allowedRoles bên dưới — RoleHome tự
                                điều hướng Admin/Manager sang đúng dashboard của họ,
                                không thể để "/" bị chặn vì chính nó là đích redirect. */}
                            <Route path="/" element={<RoleHome />} />

                            {/* Mọi route Employee còn lại: BẮT BUỘC allowedRoles,
                                giống hệt nhóm Manager/Admin bên dưới — thiếu dòng
                                này là bug thật đã xảy ra: Admin/Manager gõ thẳng URL
                                /employee/... vẫn vào được (chỉ khác sidebar vì
                                Sidebar.jsx tự chọn menu theo role thật, không theo
                                route đang render). */}
                            <Route element={<ProtectedRoute allowedRoles={["EMPLOYEE"]} />}>
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/employee/dashboard" element={<DashboardPage />} />
                                <Route path="/employee/profile" element={<ProfilePage />} />
                                <Route path="/my-performance" element={<MyPerformancePage />} />
                                <Route path="/employee/my-performance" element={<MyPerformancePage />} />
                                <Route path="/notifications" element={<NotificationsPage />} />
                                <Route path="/employee/notifications" element={<NotificationsPage />} />
                                <Route path="/my-tasks" element={<MyTasksPage />} />
                                <Route path="/employee/my-tasks" element={<MyTasksPage />} />
                                <Route path="/employee/team" element={<MyTeamPage />} />
                                <Route path="/employee/timesheet" element={<TimesheetPage />} />
                                <Route path="/employee/chat" element={<EmployeeChatPage />} />
                                <Route path="/employee/audit-logs" element={<EmployeeAuditLogsPage />} />
                            </Route>
                        </Route>

                        {/* Phân hệ MANAGER */}
                        <Route element={<ProtectedRoute allowedRoles={["MANAGER", "ADMIN"]} />}>
                            <Route path="/manager" element={<ManagerLayout />}>
                                <Route index element={<Navigate to="/manager/dashboard" replace />} />
                                <Route path="dashboard" element={<ManagerDashboardPage />} />
                                <Route path="jobs" element={<ManagerJobsPage />} />
                                <Route path="jobs/:id" element={<ManagerJobDetailPage />} />
                                <Route path="jobs/:jobId/kanban" element={<ManagerKanbanPage />} />
                                <Route path="kanban" element={<ManagerKanbanPage />} />
                                <Route path="tasks/review" element={<ManagerTaskReviewPage />} />
                                <Route path="tasks-qa" element={<ManagerTaskReviewPage />} />
                                <Route path="team" element={<ManagerTeamPage />} />
                                <Route path="timesheet" element={<ManagerTimesheetReviewPage />} />
                                <Route path="timesheets/review" element={<ManagerTimesheetReviewPage />} />
                                <Route path="timelock" element={<ManagerTimeLockPage />} />
                                <Route path="timelocks" element={<ManagerTimeLockPage />} />
                                <Route path="reports" element={<ManagerReportsPage />} />
                                <Route path="chat" element={<ManagerChatPage />} />
                                <Route path="notifications" element={<ManagerNotificationsPage />} />
                                <Route path="profile" element={<ManagerProfilePage />} />
                                <Route path="audit-logs" element={<ManagerAuditLogsPage />} />
                            </Route>
                        </Route>

                        {/* Phân hệ ADMIN */}
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