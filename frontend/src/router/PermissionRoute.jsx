import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

/**
 * PermissionRoute — restricts a route to users who hold a specific permission code.
 * Must be nested inside ProtectedRoute. Redirects to /unauthorized if the
 * user's permission list does not include the required code.
 */

export default function PermissionRoute({ permission }) {
    const { user } = useAuth()

    if (!user?.permissions?.includes(permission)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <Outlet />
}
