import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link } from "react-router-dom"
import { useLogin } from "../../hooks/useLogin"

// Login page — dark glassmorphism theme (frontend-design-system.md
// ). Purely presentational: form state comes from react-hook-form,
// submit logic comes entirely from useLogin(). No axios/store calls here.

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
    // Without this, zod silently strips rememberMe from the validated
    // data before it reaches submitLogin, since zod drops any field not
    // declared in the schema by default.
    rememberMe: z.boolean().optional(),
})

// Renders the login form and wires it to useLogin().
export function LoginPage() {
    const { submitLogin, loading, error } = useLogin()
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(loginSchema),
    })

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
                        <h2 className="text-xl font-bold text-white tracking-tight">Sign In</h2>
                        <p className="text-xs text-slate-400">Enter your corporate email and password to continue.</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit(submitLogin)}>
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

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-300">Password</label>
                                <Link to="/forgot-password" className="text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                type="password"
                                placeholder="••••••••••••"
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                                {...register("password")}
                            />
                            {errors.password && <p className="text-[11px] text-rose-400">{errors.password.message}</p>}
                        </div>

                        {error && <p className="text-[11px] text-rose-400">{error}</p>}

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500/40"
                                {...register("rememberMe")}
                            />
                            <label htmlFor="rememberMe" className="text-xs text-slate-300 cursor-pointer select-none">
                                Remember me
                            </label>
                        </div>


                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-60"
                        >
                            {loading ? "Signing in..." : "Sign In to WorkTracker"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
