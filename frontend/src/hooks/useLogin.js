import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { login as loginApi } from "../api/authApi"
import { useAuth } from "./useAuth"

// Wraps the login form flow: calls the API, updates auth state on
// success, and navigates to the dashboard. Exposes loading/error state
// so LoginPage can render a spinner or error message without knowing
// anything about Axios or the auth store.

// Returns a submit handler plus loading/error state for the login form.
export function useLogin() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Calls the login API, stores the tokens/user on success, then
    // navigates to the dashboard.
    async function submitLogin({ email, password, rememberMe }) {
    setLoading(true)
    setError(null)
    try {
        const data = await loginApi({ email, password })
        login(data, data.user, rememberMe)
        navigate("/")
    } catch (err) {
        setError(err.response?.data?.detail || "Login failed")
    } finally {
        setLoading(false)
    }
}


    return { submitLogin, loading, error } //Đặt tên submitLogin (không phải login) để không trùng tên với action login lấy từ useAuth() — 2 khái niệm khác nhau: 1 cái gọi API+điều hướng, 1 cái chỉ set state.
}
