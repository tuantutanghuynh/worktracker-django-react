import { Outlet } from "react-router-dom"
import { Sidebar } from "../components/common/layout/Sidebar"
import { Header } from "../components/common/layout/Header"
import { Footer } from "../components/common/layout/Footer"
import { useAuth } from "../hooks/useAuth"

// Shell every Employee page renders inside. The only place in this
// group that calls useAuth() — passes user/logout down as props so
// Sidebar/Header/Footer stay pure presentational components.
export function EmployeeLayout() {
    const { user, logout } = useAuth()

    return (
        <div className="flex h-screen overflow-hidden">
            <aside className="w-64 bg-sidebar border-r border-slate-800 flex flex-col justify-between p-4 h-screen shrink-0">
                <Sidebar unreadCount={0} />
                <Footer user={user} onLogout={logout} />
            </aside>
            <main className="flex-1 bg-slate-50 text-slate-800 p-6 h-screen overflow-y-auto space-y-6">
                <Header user={user} breadcrumb="Employee" />
                <Outlet />
            </main>
        </div>
    )
}
