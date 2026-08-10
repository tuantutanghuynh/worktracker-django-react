import axiosClient from "./axiosClient"

// Auth service layer — plain Axios calls only, no React/hooks here.
// Each function maps 1:1 to a backend auth endpoint and returns the
// unwrapped response body (not the full Axios response object).
// Field names must match the backend serializer exactly (snake_case
// for old_password/new_password) — mismatched keys fail silently as
// a 400 from Django, not a JS error here.
// Errors are intentionally NOT caught here; they bubble up to the
// calling hook (useLogin, useChangePassword, ...) to handle.

// Authenticates with email/password, returns { access, refresh, user }.
export async function login({ email, password }) {
    const { data } = await axiosClient.post("/auth/login/", { email, password })
    return data
}

// Requests a password reset token be emailed to the given address.
export async function forgotPassword({ email }) {
    const { data } = await axiosClient.post("/auth/forgot-password/", { email })
    return data
}

// Exchanges a valid reset token for a new password.
export async function resetPassword({ token, new_password }) {
    const { data } = await axiosClient.post("/auth/reset-password/", { token, new_password })
    return data
}

// Changes the current user's password (requires an authenticated request).
export async function changePassword({ old_password, new_password }) {
    const { data } = await axiosClient.post("/auth/change-password/", { old_password, new_password })
    return data
}
