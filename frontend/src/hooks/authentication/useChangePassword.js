import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { changePassword as changePasswordApi } from "../../api/authApi"
import { useAuth } from "../useAuth"
import { useAuthStore } from "../../stores/authStore"

// Wraps the "change password" flow — used both for a voluntary change
// and the forced first-login change gated by must_change_password.
// Updates the cached user afterward so ProtectedRoute stops redirecting,
// then sends the user into the app.

// Returns a submit handler plus loading/error state.
export function useChangePassword() {
    const { user, setUser } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Submits the old/new password, updates auth tokens & user with must_change_password=false,
    // then navigates directly to the appropriate role dashboard without logging out.
    async function submitChangePassword({ old_password, new_password }) {
        setLoading(true)
        setError(null)
        try {
            const data = await changePasswordApi({ old_password, new_password })
            if (data?.access && data?.user) {
                useAuthStore.getState().setTokens(data.access, data.refresh)
                useAuthStore.getState().setUser(data.user)
                toast.success("Password changed successfully! Welcome to WorkTracker.")

                const role = (data.user?.role || "").toUpperCase()
                if (role === "ADMIN") {
                    navigate("/admin", { replace: true })
                } else if (role === "MANAGER") {
                    navigate("/manager/dashboard", { replace: true })
                } else {
                    navigate("/employee/dashboard", { replace: true })
                }
            } else {
                useAuthStore.getState().logout()
                navigate("/login", { replace: true })
            }
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.old_password?.[0] || err.response?.data?.new_password?.[0] || "Change password failed")
        } finally {
            setLoading(false)
        }
    }

    return { submitChangePassword, loading, error }
}
