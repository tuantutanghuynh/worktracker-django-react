import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

// Route guard: blocks access to its child routes unless the logged-in
// user's role is in allowedRoles. Generic and reusable across
// Admin/Manager/Employee — pass the allowed roles via props, don't
// hardcode a role name in this file.

// Renders the nested routes only when user.role is in allowedRoles.
export function RoleRoute({ allowedRoles }) {
    const { user } = useAuth()
    const hasAccess = allowedRoles.includes(user?.role)
    return hasAccess ? <Outlet /> : <Navigate to="/" replace />
}
