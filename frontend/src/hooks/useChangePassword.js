import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { changePassword as changePasswordApi } from "../api/authApi"
import { useAuth } from "./useAuth"

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

    // Submits the old/new password, clears must_change_password on the
    // cached user, then navigates into the app.
    async function submitChangePassword({ old_password, new_password }) {
        setLoading(true)
        setError(null)
        try {
            await changePasswordApi({ old_password, new_password })
            setUser({ ...user, must_change_password: false })
            navigate("/")
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || "Change password failed")
        } finally {
            setLoading(false)
        }
    }

    return { submitChangePassword, loading, error }
}
