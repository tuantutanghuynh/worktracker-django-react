import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const axiosClient = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
})

axiosClient.interceptors.request.use((config) => {
    const { accessToken } = useAuthStore.getState()
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
})

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