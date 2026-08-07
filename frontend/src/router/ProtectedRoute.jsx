import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export function ProtectedRoute() {
    const { isLoggedIn } = useAuth()
    return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />
}
