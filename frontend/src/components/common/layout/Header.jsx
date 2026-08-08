import { Link } from "react-router-dom"
import { Search, Bell, ChevronDown } from "lucide-react"

// Top bar for the Employee shell. Pure presentational: user/unreadCount
// come via props, no hooks, no API calls. Note: the login response only
// carries { id, email, role, must_change_password, permissions } — no
// full_name — so this shows email until a real profile fetch exists.
export function Header({ user, unreadCount = 0, breadcrumb }) {
    return (
        <header className="flex items-center justify-between">
            <nav className="text-xs text-slate-500 font-medium">{breadcrumb}</nav>

            <div className="flex items-center space-x-4">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Search tasks, jobs..."
                        className="w-64 pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                </div>

                <Link to="/notifications" className="relative text-slate-500 hover:text-slate-700 p-1.5">
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                            {unreadCount}
                        </span>
                    )}
                </Link>

                <Link
                    to="/profile"
                    className="flex items-center space-x-2 bg-white border border-slate-200 pl-1.5 pr-3 py-1 rounded-full shadow-sm hover:border-slate-300 transition"
                >
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                        {user?.email?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{user?.email}</span>
                    <ChevronDown size={12} className="text-slate-400" />
                </Link>
            </div>
        </header>
    )
}
