import { useState } from "react"
import { forgotPassword as forgotPasswordApi } from "../api/authApi"

// Wraps the "forgot password" form flow. The backend always replies
// with the same generic message whether the email exists or not
// (anti user-enumeration), so there's no "email not found" case here —
// only network/validation failures.

// Returns a submit handler plus loading/error/success state.
export function useForgotPassword() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    // Requests a reset email for the given address.
    async function submitForgotPassword({ email }) {
        setLoading(true)
        setError(null)
        try {
            await forgotPasswordApi({ email })
            setSuccess(true)
        } catch (err) {
            setError(err.response?.data?.email?.[0] || "Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return { submitForgotPassword, loading, error, success }
}
