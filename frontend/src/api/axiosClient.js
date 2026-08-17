import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
// Axios instance shared by the whole app. Two interceptors handle auth
// transparently: the request interceptor attaches the current access
// token, the response interceptor catches 401s and retries once after
// refreshing the token. Callers just use axiosClient like plain axios
// and never have to think about tokens themselves.

const BASE_HOST = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE_URL = BASE_HOST.endsWith('/api') ? BASE_HOST : `${BASE_HOST.replace(/\/$/, '')}/api`;

// 1. Khởi tạo Axios Instance dùng chung với Timeout 15 giây
const axiosClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000, // Thêm timeout 15 giây chống treo app
});

// Attaches the current access token to every outgoing request, if present.
axiosClient.interceptors.request.use(
    (config) => {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Biến quản lý trạng thái Refresh Token & Hàng đợi Request bị ngắt quãng
let isRefreshing = false;
let failedQueue = [];

// Hàm xử lý đẩy lại các request trong hàng đợi sau khi Refresh Token thành công/thất bại
const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// On 401, refreshes the token once and retries the original request;
// logs the user out if there's no refresh token or the refresh fails.
axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Kiểm tra nếu bị lỗi 401 và request này chưa từng retry
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            // Nếu đang có 1 request khác tiến hành Refresh Token ➔ Đưa request hiện tại vào Hàng đợi (Queue)
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axiosClient(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const { refreshToken, setTokens, logout } = useAuthStore.getState();

            // Nếu không có Refresh Token ➔ Đăng xuất người dùng ngay
            if (!refreshToken) {
                isRefreshing = false;
                logout();
                return Promise.reject(error);
            }

            try {
                // Gọi API Refresh Token trực tiếp từ Axios gốc để tránh lặp vô hạn Interceptor
                const refreshUrl = `${API_BASE_URL}/auth/refresh/`;
                const response = await axios.post(refreshUrl, { refresh: refreshToken });

                const newAccess = response.data.access || response.data.accessToken;
                const newRefresh = response.data.refresh || refreshToken;

                if (newAccess) {
                    // Cập nhật Token mới vào Zustand Store
                    setTokens(newAccess, newRefresh);

                    // Cập nhật Header cho request hiện tại và các request tiếp theo
                    axiosClient.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
                    originalRequest.headers.Authorization = `Bearer ${newAccess}`;

                    // Giải phóng hàng đợi cho tất cả các request song song khác
                    processQueue(null, newAccess);
                    isRefreshing = false;

                    // Thực thi lại request ban đầu bị lỗi
                    return axiosClient(originalRequest);
                }
            } catch (refreshError) {
                // Refresh Token thất bại ➔ Reject toàn bộ hàng đợi & Đăng xuất
                processQueue(refreshError, null);
                isRefreshing = false;
                logout();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default axiosClient;