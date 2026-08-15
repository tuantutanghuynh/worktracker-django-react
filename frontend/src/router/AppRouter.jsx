import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Pages thuộc Auth (Nhóm Tú)
import { LoginPage } from '../pages/auth/LoginPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { ChangePasswordPage } from '../pages/auth/ChangePasswordPage';

// Layouts
import ManagerLayout from '../layouts/ManagerLayout';
// import { EmployeeLayout } from '../layouts/EmployeeLayout';
//import { ProfilePage } from '../pages/employee/ProfilePage';

// Lazy load các trang phân hệ Manager (Phụ trách bởi Bạn)
const ManagerDashboardPage = lazy(() => import('../pages/manager/ManagerDashboardPage'));
const ManagerJobsPage = lazy(() => import('../pages/manager/ManagerJobsPage'));
const ManagerJobDetailPage = lazy(() => import('../pages/manager/ManagerJobDetailPage'));
const ManagerKanbanPage = lazy(() => import('../pages/manager/ManagerKanbanPage'));
const ManagerTeamPage = lazy(() => import('../pages/manager/ManagerTeamPage'));
const ManagerTimesheetReviewPage = lazy(() => import('../pages/manager/ManagerTimesheetReviewPage'));
const ManagerTimeLockPage = lazy(() => import('../pages/manager/ManagerTimeLockPage'));
const ManagerReportsPage = lazy(() => import('../pages/manager/ManagerReportsPage'));
const ManagerNotificationsPage = lazy(() => import('../pages/manager/ManagerNotificationsPage'));
const ManagerChatPage = lazy(() => import('../pages/manager/ManagerChatPage'));
const ManagerProfilePage = lazy(() => import('../pages/manager/ManagerProfilePage'));
const ManagerSettingsPage = lazy(() => import('../pages/manager/ManagerSettingsPage'));

function PageLoadingSpinner() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Loading App...</p>
            </div>
        </div>
    );
}

export function AppRouter() {
    return (
        <BrowserRouter>
            <Suspense fallback={<PageLoadingSpinner />}>
                <Routes>
                    {/* Public Auth Routes (Dùng chung) */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* Protected Routes (Bắt buộc Đăng nhập) */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/change-password" element={<ChangePasswordPage />} />

                        {/* Cụm Route Phân hệ Employee (Nhóm Tú) */}
                        {/* <Route element={<EmployeeLayout />}>
                            <Route path="/employee/dashboard" element={<div>Employee Dashboard</div>} />
                            <Route path="/profile" element={<ProfilePage />} />
                        </Route> */}

                        {/* Cụm Route Phân hệ Manager (Của Bạn) */}
                        <Route element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
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
                    </Route>

                    {/* Điều hướng mặc định */}
                    <Route path="/" element={<Navigate to="/manager/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

export default AppRouter;