import { LogOut } from "lucide-react"

// Sidebar footer — avatar + online dot + email/role (matches mockup's
// "User Profile Footer"), plus a working logout button. The mockup uses
// an ellipsis icon (implies a dropdown menu, not built in the static
// demo) — using a direct LogOut icon here instead, since logout needs
// to actually work now, not just look right.
export function Footer({ user, onLogout }) {
    return (
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 min-w-0">
                <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                        {user?.email?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-sidebar absolute bottom-0 right-0" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-tight truncate">{user?.email}</p>
                    <p className="text-[10px] text-slate-400">{user?.role}</p>
                </div>
            </div>
            <button
                type="button"
                onClick={onLogout}
                title="Log out"
                className="text-slate-500 hover:text-slate-300 transition shrink-0"
            >
                <LogOut size={14} />
            </button>
        </div>
    )
}
