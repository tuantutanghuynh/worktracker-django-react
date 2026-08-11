import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export function RoleRoute({ allowedRoles }) {
    const { user } = useAuth()
    const hasAccess = allowedRoles.includes(user?.role)
    return hasAccess ? <Outlet /> : <Navigate to="/" replace />
}
