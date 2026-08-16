import { Outlet } from "react-router-dom"
import Sidebar from "../components/common/layout/Sidebar"
import Header from "../components/common/layout/Header"
import Footer from "../components/common/layout/Footer"

// Shell every Employee page renders inside. Sidebar/Header now manage
// their own state internally (useAuth for user/logout, useUIStore for
// the collapsed flag) instead of receiving it as props from here — this
// layout just arranges them and lets React Router fill <Outlet />.
export function EmployeeLayout() {
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-y-auto">
                <Header />
                <main className="flex-1 bg-slate-50 text-slate-800 p-6 space-y-6">
                    <Outlet />
                </main>
                <Footer />
            </div>
        </div>
    )
}
