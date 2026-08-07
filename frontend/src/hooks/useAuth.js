import { useAuthStore } from "../stores/authStore"


export function useAuth() {
    //4 subscription riêng biệt — không gộp thành const { user, accessToken, login, logout } = useAuthStore()
    const user = useAuthStore((state) => state.user)
    const accessToken = useAuthStore((state) => state.accessToken)
    const login = useAuthStore((state) => state.login)
    const logout = useAuthStore((state) => state.logout)

    return {
        user,
        isLoggedIn: !!accessToken, //!!accessToken là giá trị suy ra, không lưu thành field riêng trong store — nếu lưu riêng, dễ có ngày quên cập nhật đồng bộ với accessToken ở 1 action nào đó, gây 2 nguồn sự thật lệch nhau.
        login,
        logout,
    }
}
