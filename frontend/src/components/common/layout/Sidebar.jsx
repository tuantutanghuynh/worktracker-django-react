import { Link, useLocation } from "react-router-dom"
import { LayoutGrid, ListChecks, Clock, TrendingUp, Bell, User } from "lucide-react"

// Employee sidebar nav — highlights the active route via useLocation().
// Routes below don't have real pages yet (Phase 3) except "/"; linking
// now is safe since react-router just falls through to "*" until built.
const NAV_ITEMS = [
    { to: "/", label: "Dashboard", icon: LayoutGrid },
    { to: "/my-tasks", label: "My Tasks", icon: ListChecks },
    { to: "/timesheet", label: "Timesheet", icon: Clock },
    { to: "/my-performance", label: "My Performance", icon: TrendingUp },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
]

// Renders the nav list; unreadCount badges Notifications; recentJobs
// (optional, defaults empty) feeds the "Recently Viewed Jobs" list —
// no API for this exists yet, Phase 3 pages will pass real data.
export function Sidebar({ unreadCount = 0, recentJobs = [] }) {
    const location = useLocation()

    return (
        <div className="space-y-3.5">
            <div className="px-2 py-0.5">
                <span className="text-xl font-bold tracking-tight text-white leading-none">
                    WorkTracker <span className="text-xs font-semibold text-blue-400">Pro</span>
                </span>
            </div>

            <nav className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
                    EMPLOYEE PORTAL
                </p>
                {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                    const isActive = location.pathname === to
                    return (
                        <Link
                            key={to}
                            to={to}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                                isActive
                                    ? "font-semibold text-white bg-blue-600 shadow-md shadow-blue-600/30"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                            }`}
                        >
                            <div className="flex items-center space-x-3">
                                <Icon size={16} />
                                <span>{label}</span>
                            </div>
                            {label === "Notifications" && unreadCount > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Quick Access — removed: Notifications here duplicated both the
            main nav item above AND the Header bell (same route, same badge,
            visible 3x on one screen); Search duplicated Header's search box
            with no real command-palette behavior behind it. Kept as a
            comment (not deleted) in case a genuine Cmd+K palette gets built
            later, distinct from Header's inline filter search.
            <div className="space-y-0.5 pt-2.5 border-t border-slate-800/80">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
                    Quick Access
                </p>
                <Link
                    to="/notifications"
                    className="flex items-center justify-between px-3 py-1.5 text-sm text-slate-400 hover:text-white transition"
                >
                    <div className="flex items-center space-x-3">
                        <Bell size={16} />
                        <span>Notifications</span>
                    </div>
                    {unreadCount > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </Link>
                <button
                    type="button"
                    className="w-full flex items-center space-x-3 px-3 py-1.5 text-sm text-slate-400 hover:text-white transition"
                >
                    <Search size={16} />
                    <span>Search (Ctrl + K)</span>
                </button>
            </div>
            */}

            {recentJobs.length > 0 && (
                <div className="space-y-1 pt-2.5 border-t border-slate-800/80">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-0.5">
                        Recently Viewed Jobs
                    </p>
                    {recentJobs.map((job) => (
                        <div
                            key={job.id}
                            className="px-3 py-1 rounded-lg hover:bg-slate-800/40 cursor-pointer flex items-center space-x-2.5"
                        >
                            <div className={`w-2.5 h-2.5 rounded shrink-0 ${job.dotColor ?? "bg-slate-500"}`} />
                            <div className="overflow-hidden">
                                <p className="text-xs font-semibold text-slate-200 truncate">{job.name}</p>
                                <span className={`text-[9px] font-bold ${job.statusColor ?? "text-slate-400"}`}>
                                    {job.status}
                                </span>
                            </div>
                        </div>
                    ))}
                    <Link
                        to="/my-tasks"
                        className="inline-block px-3 pt-0.5 text-[11px] font-medium text-blue-400 hover:underline"
                    >
                        View all tasks →
                    </Link>
                </div>
            )}
        </div>
    )
}
