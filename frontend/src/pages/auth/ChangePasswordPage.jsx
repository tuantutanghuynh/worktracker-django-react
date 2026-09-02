import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useChangePassword } from "../../hooks/authentication/useChangePassword"
import { useAuthStore } from "../../stores/authStore"

// Change-password page — used both for a voluntary password change and
// the forced first-login change gated by must_change_password (FR-04).

// The backend (ChangePasswordSerializer) calls set_password() directly,
// never validate_password() — so this schema is currently the ONLY
// place enforcing password strength for this flow. Keep these rules in
// sync with the bullet list rendered below.
const changePasswordSchema = z.object({
    old_password: z.string().min(1, "Current password is required"),
    new_password: z.string()
        .min(8, "At least 8 characters")
        .regex(/[a-z]/, "Must contain a lowercase letter")
        .regex(/[A-Z]/, "Must contain an uppercase letter")
        .regex(/[0-9]/, "Must contain a number")
        .regex(/[^A-Za-z0-9]/, "Must contain a special symbol"),
    confirm_new_password: z.string(),
}).refine((data) => data.new_password === data.confirm_new_password, {
    message: "Passwords do not match",
    path: ["confirm_new_password"],
})

// Renders the change-password form and wires it to useChangePassword().
export function ChangePasswordPage() {
    const navigate = useNavigate()
    const [showOldPassword, setShowOldPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const { submitChangePassword, loading, error } = useChangePassword()
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(changePasswordSchema),
    })

    function handleBackToLogin() {
        useAuthStore.getState().logout()
        navigate("/login", { replace: true })
    }

    function onSubmit(data) {
        submitChangePassword({ old_password: data.old_password, new_password: data.new_password })
    }

    return (
        <div className="bg-[#060B19] text-slate-100 min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center space-x-3 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800 shadow-xl">
                        <svg className="w-7 h-7 shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="wBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#60A5FA" />
                                    <stop offset="40%" stopColor="#3B82F6" />
                                    <stop offset="80%" stopColor="#2563EB" />
                                    <stop offset="100%" stopColor="#1D4ED8" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M 22 55 Q 32 88 46 88 Q 58 88 66 50 Q 76 88 88 88 Q 98 88 108 26"
                                stroke="url(#wBlueGradient)"
                                strokeWidth="13"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="text-xl font-bold text-white">
                            WorkTracker <span className="text-xs text-blue-400">Pro</span>
                        </span>
                    </div>
                </div>

                <div className="bg-slate-900/85 backdrop-blur-lg border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
                    <div className="space-y-1.5 border-b border-slate-800/80 pb-4 text-center">
                        <h2 className="text-lg font-bold text-white">Change Password</h2>
                        <p className="text-xs text-slate-400">You must set a new password to continue using the system.</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showOldPassword ? "text" : "password"}
                                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    {...register("old_password")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowOldPassword(!showOldPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition focus:outline-none"
                                >
                                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.old_password && <p className="text-[11px] text-rose-400">{errors.old_password.message}</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    {...register("new_password")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition focus:outline-none"
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.new_password && <p className="text-[11px] text-rose-400">{errors.new_password.message}</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">Confirm New Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    {...register("confirm_new_password")}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition focus:outline-none"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.confirm_new_password && <p className="text-[11px] text-rose-400">{errors.confirm_new_password.message}</p>}
                        </div>

                        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-400">
                            <p className="font-bold text-slate-300">Password Rules:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>Minimum 8 characters long</li>
                                <li>Contains uppercase & lowercase letters</li>
                                <li>Contains at least 1 number and 1 special symbol</li>
                            </ul>
                        </div>

                        {error && <p className="text-[11px] text-rose-400">{error}</p>}

                        <div className="space-y-2.5 pt-1">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-60"
                            >
                                {loading ? "Updating..." : "Update Password"}
                            </button>

                            <button
                                type="button"
                                onClick={handleBackToLogin}
                                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white font-semibold rounded-xl text-xs transition border border-slate-700/60 flex items-center justify-center space-x-1.5"
                            >
                                <span>← Back to Login</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
