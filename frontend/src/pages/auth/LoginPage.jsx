import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, Sparkles, Zap, Lock, BarChart3 } from "lucide-react";
import { useLogin } from "../../hooks/authentication/useLogin";

/**
 * Module: pages/auth/LoginPage
 * Description: Split-screen enterprise authentication page with responsive layout, glowing watermark brand graphics, and form validation.
 */

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { submitLogin, loading, error } = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: true,
    },
  });

  return (
    <div className='w-full min-h-screen flex flex-col lg:flex-row bg-[#070D1E] text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-blue-500 selection:text-white'>
      {/* LEFT COLUMN: Authentication Form (42-45%) */}
      <div className='w-full lg:w-[45%] xl:w-[42%] min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 bg-[#0A1227] border-r border-blue-950/60 z-10 relative'>
        {/* Brand Header */}
        <div className='mb-8 sm:mb-10'>
          <div className='inline-flex items-center space-x-3 group'>
            <div className='w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:border-blue-400/50 transition-all'>
              <svg className='w-6 h-6 shrink-0' viewBox='0 0 120 120' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <defs>
                  <linearGradient id='wBlueGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                    <stop offset='0%' stopColor='#93C5FD' />
                    <stop offset='40%' stopColor='#3B82F6' />
                    <stop offset='100%' stopColor='#1D4ED8' />
                  </linearGradient>
                </defs>
                <path
                  d='M 22 55 Q 32 88 46 88 Q 58 88 66 50 Q 76 88 88 88 Q 98 88 108 26'
                  stroke='url(#wBlueGrad)'
                  strokeWidth='13'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </div>
            <div>
              <span className='text-xl font-bold text-white tracking-tight'>WorkTracker</span>
              <span className='text-[11px] font-semibold px-1.5 py-0.5 ml-1.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30'>PRO</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className='my-auto max-w-md w-full mx-auto space-y-6 sm:space-y-7'>
          <div className='space-y-2'>
            <h1 className='text-3xl sm:text-4xl font-extrabold text-white tracking-tight'>Sign in</h1>
            
          </div>

          <form className='space-y-5' onSubmit={handleSubmit(submitLogin)}>
            {/* Email Input */}
            <div className='space-y-2'>
              <label className='block text-xs font-semibold text-slate-200 tracking-wide uppercase'>
                Email address <span className='text-blue-400'>*</span>
              </label>
              <input
                type='email'
                placeholder='name@company.com'
                className='w-full px-4 py-3 bg-[#0F1C3F] border border-blue-900/60 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition shadow-inner'
                {...register("email")}
              />
              {errors.email && <p className='text-xs text-rose-400 font-medium'>{errors.email.message}</p>}
            </div>

            {/* Password Input */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <label className='block text-xs font-semibold text-slate-200 tracking-wide uppercase'>
                  Password <span className='text-blue-400'>*</span>
                </label>
              </div>
              <div className='relative'>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder='••••••••••••'
                  className='w-full pl-4 pr-12 py-3 bg-[#0F1C3F] border border-blue-900/60 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition shadow-inner'
                  {...register("password")}
                />
                <button
                  type='button'
                  onClick={() => setShowPassword((prev) => !prev)}
                  className='absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1 cursor-pointer'
                  title={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                </button>
              </div>
              {errors.password && <p className='text-xs text-rose-400 font-medium'>{errors.password.message}</p>}
            </div>

            {/* Server Error Display */}
            {error && <div className='p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300'>{error}</div>}

            {/* Remember Me & Forgot Password */}
            <div className='flex items-center justify-between pt-1'>
              <label className='flex items-center space-x-2.5 cursor-pointer group'>
                <input
                  type='checkbox'
                  id='rememberMe'
                  className='w-4 h-4 rounded bg-[#0F1C3F] border-blue-900/80 text-blue-600 focus:ring-blue-500/40 transition'
                  {...register("rememberMe")}
                />
                <span className='text-xs text-slate-300 group-hover:text-white transition select-none font-medium'>Remember me</span>
              </label>
              <Link to='/forgot-password' className='text-xs font-semibold text-blue-400 hover:text-blue-300 transition hover:underline'>
                Forgot password?
              </Link>
            </div>

            {/* Primary Submit Button */}
            <button
              type='submit'
              disabled={loading}
              className='w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl text-sm shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-60 disabled:transform-none'>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Security Notice Card */}
          <div className='p-4 rounded-xl bg-blue-950/40 border border-blue-900/50 backdrop-blur-sm text-xs text-slate-300 leading-relaxed'>
            <p className='font-semibold text-blue-300 mb-1 flex items-center gap-1.5'>
              <ShieldCheck className='w-4 h-4 text-blue-400 shrink-0' />
              Enterprise Security Enforced
            </p>
            Single Sign-On and Role-Based Access are protected. Use your official company credentials to sign in.
          </div>
        </div>

        {/* Footer Copyright */}
        <div className='pt-8 text-xs text-slate-500 text-center lg:text-left'>&copy; 2026 WorkTracker Pro Inc. All rights reserved.</div>
      </div>

      {/* RIGHT COLUMN: Hero & Community Showcase Banner (55-58%) */}
      <div className='hidden lg:flex lg:w-[55%] xl:w-[58%] relative flex-col justify-center items-center p-12 xl:p-20 bg-gradient-to-br from-[#060D20] via-[#091636] to-[#040A18] overflow-hidden'>
        {/* Decorative Element 1: Dot Matrix Pattern */}
        <div
          className='absolute top-8 right-8 w-44 h-44 opacity-40 pointer-events-none'
          style={{
            backgroundImage: "radial-gradient(rgba(96, 165, 250, 0.35) 1.5px, transparent 1.5px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Decorative Element 2: Ambient Blur Glow Orbs */}
        <div className='absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none' />
        <div className='absolute -bottom-28 -right-28 w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-3xl pointer-events-none' />

        {/* Decorative Element 3: Giant Glowing Blue 'W' Logo Watermark */}
        <div className='absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0'>
          <svg className='w-[760px] h-[760px] text-blue-500/15 blur-[1px] animate-pulse' viewBox='0 0 120 120' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <defs>
              <linearGradient id='giantWatermarkGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stopColor='#60A5FA' stopOpacity='0.25' />
                <stop offset='50%' stopColor='#3B82F6' stopOpacity='0.15' />
                <stop offset='100%' stopColor='#1D4ED8' stopOpacity='0.08' />
              </linearGradient>
            </defs>
            <path
              d='M 22 55 Q 32 88 46 88 Q 58 88 66 50 Q 76 88 88 88 Q 98 88 108 26'
              stroke='url(#giantWatermarkGrad)'
              strokeWidth='12'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </div>

        {/* Decorative Element 4: Smooth Abstract Curved Rings */}
        <div className='absolute w-[600px] h-[600px] rounded-full border border-blue-500/10 -right-24 top-1/2 -translate-y-1/2 pointer-events-none' />
        <div className='absolute w-[800px] h-[800px] rounded-full border border-blue-400/5 -right-48 top-1/2 -translate-y-1/2 pointer-events-none' />

        {/* Hero Showcase Content */}
        <div className='relative z-10 max-w-xl text-center space-y-8 backdrop-blur-[2px]'>
          {/* Headline */}
          <h2 className='text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight'>Welcome to our community</h2>

          {/* Subtext */}
          <p className='text-base xl:text-lg text-slate-300 leading-relaxed font-normal'>
            WorkTracker helps enterprise teams organize tasks, coordinate projects, and track detailed timesheets with automated period locks and high-fidelity analytics.
          </p>

          {/* Social Proof / Avatars Stack (Matching Image 1) */}
          <div className='pt-4 flex flex-col sm:flex-row items-center justify-center gap-4'></div>

          {/* Capability Badges */}
          <div className='pt-6 flex flex-wrap justify-center gap-2.5'>
            <span className='inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-800/40 text-xs font-medium text-blue-300 shadow-sm'>
              <Zap className='w-3.5 h-3.5 text-blue-400' /> Real-time Kanban
            </span>
            <span className='inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-800/40 text-xs font-medium text-blue-300 shadow-sm'>
              <Lock className='w-3.5 h-3.5 text-blue-400' /> Auto TimeLock
            </span>
            <span className='inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-800/40 text-xs font-medium text-blue-300 shadow-sm'>
              <BarChart3 className='w-3.5 h-3.5 text-blue-400' /> Effort Analytics
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
