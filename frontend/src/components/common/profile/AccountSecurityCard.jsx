import { Link } from "react-router-dom"
import { ShieldCheck } from "lucide-react"

// Shows account status and links to the change-password flow. No props
// needed for "Active" — reaching this page at all already proves the
// account is active (WorkTrackerJWTAuthentication blocks inactive
// accounts at the auth layer, before any page can render).
export function AccountSecurityCard() {
    return (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Account Security</h3>
            <div className="flex items-center space-x-2 text-xs text-slate-600">
                <ShieldCheck size={14} className="text-slate-400" />
                <span className="font-medium">Account Status:</span>
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                </span>
            </div>
            <Link
                to="/change-password"
                className="inline-block bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 font-bold px-4 py-2 rounded-lg text-xs transition"
            >
                Change Password
            </Link>
        </div>
    )
}
