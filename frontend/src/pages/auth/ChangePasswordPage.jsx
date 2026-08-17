import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useChangePassword } from "../../hooks/useChangePassword"

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
    const { submitChangePassword, loading, error } = useChangePassword()
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(changePasswordSchema),
    })

    function onSubmit(data) {
        submitChangePassword({ old_password: data.old_password, new_password: data.new_password })
    }

    return (
        <div className="bg-[#060B19] text-slate-100 min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center space-x-3 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800 shadow-xl">
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
                            <input
                                type="password"
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                {...register("old_password")}
                            />
                            {errors.old_password && <p className="text-[11px] text-rose-400">{errors.old_password.message}</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">New Password</label>
                            <input
                                type="password"
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                {...register("new_password")}
                            />
                            {errors.new_password && <p className="text-[11px] text-rose-400">{errors.new_password.message}</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">Confirm New Password</label>
                            <input
                                type="password"
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                {...register("confirm_new_password")}
                            />
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-60"
                        >
                            {loading ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
