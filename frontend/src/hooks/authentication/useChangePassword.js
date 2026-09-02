import { useState } from "react"
import { useNavigate } from "react-router-dom"
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

    // Submits the old/new password, logs out existing session,
    // then sends the user to /login to sign in with new password.
    async function submitChangePassword({ old_password, new_password }) {
        setLoading(true)
        setError(null)
        try {
            await changePasswordApi({ old_password, new_password })
            useAuthStore.getState().logout()
            navigate("/login", { replace: true })
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.old_password?.[0] || err.response?.data?.new_password?.[0] || "Change password failed")
        } finally {
            setLoading(false)
        }
    }

    return { submitChangePassword, loading, error }
}
