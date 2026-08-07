import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "./ProtectedRoute"

export function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* TODO Phase 1: thay bằng LoginPage thật */}
                <Route path="/login" element={<div>Login page (Phase 1)</div>} />

                <Route element={<ProtectedRoute />}>
                    {/* TODO Phase 3: thay bằng Dashboard/My Tasks/Timesheet... thật */}
                    <Route path="/" element={<div>Employee Dashboard (Phase 3)</div>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
