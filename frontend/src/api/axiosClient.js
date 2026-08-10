import axios from "axios";
import { useAuthStore } from "../stores/authStore";

// Axios instance shared by the whole app. Two interceptors handle auth
// transparently: the request interceptor attaches the current access
// token, the response interceptor catches 401s and retries once after
// refreshing the token. Callers just use axiosClient like plain axios
// and never have to think about tokens themselves.
const axiosClient = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
})

// Attaches the current access token to every outgoing request, if present.
axiosClient.interceptors.request.use((config) => {
    const { accessToken } = useAuthStore.getState()
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
})

// On 401, refreshes the token once and retries the original request;
// logs the user out if there's no refresh token or the refresh fails.
axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            const { refreshToken, setTokens, logout } = useAuthStore.getState()

            if (!refreshToken) {
                logout()
                return Promise.reject(error)
            }

            try {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh/`,
                    { refresh: refreshToken }
                )
                setTokens(data.access, data.refresh)
                originalRequest.headers.Authorization = `Bearer ${data.access}`
                return axiosClient(originalRequest)
            } catch (refreshError) {
                logout()
                return Promise.reject(refreshError)
            }
        }

        return Promise.reject(error)
    }
)

export default axiosClient