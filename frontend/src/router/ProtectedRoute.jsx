import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

// Route guard: blocks access to its child routes (rendered via <Outlet/>)
// unless the user is logged in, redirecting to /login otherwise. Also
// enforces FR-04: if must_change_password is true, every protected route
// except /change-password itself redirects there — checked here (not
// just once right after login) so it also catches a manual URL, a stale
// link, or the browser back button while the flag is still true.
// allowedRoles (optional): when given, also gates by role — someone
// logged in but not in the list is redirected to "/" instead of the
// child route (e.g. keeps Employee out of /manager/*). Left undefined
// by default so wrapping /change-password or the Employee route group
// doesn't accidentally role-gate them.
export function ProtectedRoute({ allowedRoles }) {
    const { isLoggedIn, user } = useAuth()
    const location = useLocation()

    if (!isLoggedIn) {
        return <Navigate to="/login" replace />
    }

    if (user?.must_change_password && location.pathname !== "/change-password") {
        return <Navigate to="/change-password" replace />
    }

    const userRole = (user?.role || "").toUpperCase()
    if (allowedRoles?.length > 0 && !allowedRoles.includes(userRole)) {
        return <Navigate to="/" replace />
    }

    return <Outlet />
}
