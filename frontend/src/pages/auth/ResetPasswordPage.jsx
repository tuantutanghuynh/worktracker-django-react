import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSearchParams } from "react-router-dom"
import { useResetPassword } from "../../hooks/useResetPassword"

// Reset-password page — the token comes from the emailed link's URL
// query string (?token=...), not typed by the user. Only the new
// password fields are shown; the token is merged in at submit time.

// The backend (ResetPasswordSerializer) calls set_password() directly,
// never validate_password() — so this schema is currently the ONLY
// place enforcing password strength for this flow. Keep these rules in
// sync with ChangePasswordPage.jsx and the bullet list rendered below.
const resetPasswordSchema = z.object({
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

// Renders the reset-password form and wires it to useResetPassword().
export function ResetPasswordPage() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get("token")
    const { submitResetPassword, loading, error } = useResetPassword()
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(resetPasswordSchema),
    })

    // Combines the URL token with the form's new password before submitting.
    function onSubmit(data) {
        submitResetPassword({ token, new_password: data.new_password })
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
                        <h2 className="text-xl font-bold text-white tracking-tight">Reset Password</h2>
                        <p className="text-xs text-slate-400">Choose a new password for your account.</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300">New Password</label>
                            <input
                                type="password"
                                placeholder="At least 8 characters"
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                                {...register("new_password")}
                            />
                            {errors.new_password && <p className="text-[11px] text-rose-400">{errors.new_password.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300">Confirm New Password</label>
                            <input
                                type="password"
                                placeholder="Re-type your new password"
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
