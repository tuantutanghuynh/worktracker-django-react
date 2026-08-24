import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { resetPassword as resetPasswordApi } from "../api/authApi"

// Wraps the "reset password" form flow: exchanges a reset token for a
// new password, then sends the user back to Login on success.

// Returns a submit handler plus loading/error state.
export function useResetPassword() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Submits the token + new password, then redirects to Login.
    async function submitResetPassword({ token, new_password }) {
        setLoading(true)
        setError(null)
        try {
            await resetPasswordApi({ token, new_password })
            navigate("/login")
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || "Reset failed")
        } finally {
            setLoading(false)
        }
    }

    return { submitResetPassword, loading, error }
}
