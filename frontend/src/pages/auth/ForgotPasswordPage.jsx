import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link } from "react-router-dom"
import { useForgotPassword } from "../../hooks/useForgotPassword"

// Forgot-password page — same dark glassmorphism shell as LoginPage. On
// success shows a generic confirmation (backend always replies the same
// way whether the email exists or not — anti user-enumeration).

const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
})

// Renders the forgot-password form and wires it to useForgotPassword().
export function ForgotPasswordPage() {
    const { submitForgotPassword, loading, error, success } = useForgotPassword()
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(forgotPasswordSchema),
    })

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
                        <h2 className="text-xl font-bold text-white tracking-tight">Forgot Password</h2>
                        <p className="text-xs text-slate-400">Enter your email — we&apos;ll send a reset link if the account exists.</p>
                    </div>

                    {success ? (
                        <p className="text-xs text-emerald-400">If that email exists, a reset link has been sent.</p>
                    ) : (
                        <form className="space-y-4" onSubmit={handleSubmit(submitForgotPassword)}>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-300">Email</label>
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                                    {...register("email")}
                                />
                                {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
                            </div>

                            {error && <p className="text-[11px] text-rose-400">{error}</p>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-60"
                            >
                                {loading ? "Sending..." : "Send Reset Link"}
                            </button>
                        </form>
                    )}

                    <p className="text-xs text-slate-400 text-center">
                        <Link to="/login" className="text-blue-400 hover:text-blue-300 hover:underline">Back to Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
