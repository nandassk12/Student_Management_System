import { useAuth } from '@context/AuthContext.jsx'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="animate-spin w-5 h-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  )
}

// ─── Eye icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 012.186-3.568M6.53 6.533A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.52 5.477M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export default function Login() {
  const { login, isAuthenticated, userRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ mode: 'onTouched' })

  // Redirect if already authenticated
  if (isAuthenticated) {
    const roleRedirect = {
      admin: '/admin/dashboard',
      teacher: '/teacher/dashboard',
      student: '/student/dashboard',
    }
    navigate(location.state?.from?.pathname ?? roleRedirect[userRole] ?? '/', { replace: true })
    return null
  }

  const onSubmit = async (data) => {
    setServerError('')
    setIsSubmitting(true)
    try {
      await login(data)
    } catch (err) {
      setServerError(
        err.userMessage ??
        err.response?.data?.detail ??
        'Invalid username or password. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans">
      <style>{`
        @keyframes fadeInSlideRight {
          0% { opacity: 0; transform: translateX(20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-form { animation: fadeInSlideRight 400ms ease-out forwards; }
        .btn-submit {
          transition: background-color 200ms, transform 100ms;
        }
        .btn-submit:active {
          transform: scale(0.98);
        }
      `}</style>

      {/* ── Left side (60vw width) ── */}
      <div
        style={{ width: '60vw', background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' }}
        className="hidden lg:flex relative overflow-hidden text-white h-screen"
      >
        {/* CSS/SVG Abstract Geometric Background */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <circle cx="30%" cy="40%" r="25%" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 12" />
          <circle cx="70%" cy="60%" r="35%" fill="none" stroke="white" strokeWidth="1.5" />
          <path d="M0 100 Q 250 50 500 200 T 1000 100" fill="none" stroke="white" strokeWidth="2" />
        </svg>

        {/* Outer Split Row */}
        <div className="flex w-full h-full relative z-20">
          {/* Leftmost 42vw Typography Stack */}
          <div style={{ width: '42vw' }} className="flex flex-col justify-between h-full pl-12 py-12 pr-6">
            {/* Top left Brand Logo */}
            <div className="flex items-center gap-2.5">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              <span className="text-xl font-bold tracking-tight">EduPortal</span>
            </div>

            {/* Middle Centered Content */}
            <div className="my-auto space-y-6 max-w-xl">
              <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
                Empowering Education, Simplifying Management
              </h2>
              <p className="text-lg text-white/70 font-medium whitespace-nowrap">
                A unified platform for students, teachers, and administrators
              </p>
            </div>

            {/* Balancer spacer at bottom of leftmost column */}
            <div className="h-8" />
          </div>

          {/* Rightmost 18vw Cards Column - Compressed gaps and centralized */}
          <div style={{ width: '18vw' }} className="flex flex-col justify-center h-full pr-12 items-end gap-y-5">
            {/* Card 1: Narrative Student Reports */}
            <div className="w-[290px] -translate-x-4 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <span className="truncate">Narrative Student Reports</span>
            </div>

            {/* Card 2: Institutional Analytics */}
            <div className="w-[290px] translate-x-0 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              </span>
              <span className="truncate">Institutional Analytics</span>
            </div>

            {/* Card 3 (Inward) */}
            <div className="w-[290px] -translate-x-4 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="truncate">Real-time attendance tracking</span>
            </div>

            {/* Card 4 (Outward) */}
            <div className="w-[290px] translate-x-0 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M9 13h6M9 17h6" />
                </svg>
              </span>
              <span className="truncate">Smart GPA calculator</span>
            </div>

            {/* Card 5 (Inward) */}
            <div className="w-[290px] -translate-x-4 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
              <span className="truncate">Role-based access control</span>
            </div>

            {/* Card 6 (Outward) */}
            <div className="w-[290px] translate-x-0 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
              <span className="truncate">Study material uploads</span>
            </div>

            {/* Card 7 (Inward) */}
            <div className="w-[290px] -translate-x-4 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </span>
              <span className="truncate">Leave management system</span>
            </div>

            {/* Card 8 (Outward) */}
            <div className="w-[290px] translate-x-0 flex items-center gap-3 py-2 px-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] rounded-full text-slate-200 text-sm font-medium tracking-wide hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/30 transition-all duration-300 ease-out cursor-pointer">
              <span className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18" />
                </svg>
              </span>
              <span className="truncate">Fee tracking & analytics</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right side (40vw width) ── */}
      <div
        style={{ width: '40vw' }}
        className="w-full lg:w-[40vw] bg-slate-200/60 flex flex-col justify-between p-8 sm:p-16 min-h-screen border-l border-slate-100"
      >
        {/* Empty placeholder top to balance layout */}
        <div className="hidden sm:block h-8" />

        {/* ── Outer Box Login Container ── */}
        <div className="my-auto max-w-md w-full mx-auto bg-white border border-slate-200/80 shadow-[0_20px_40px_-15px_rgba(15,23,42,0.08)] rounded-2xl p-8 sm:p-10 animate-form">
          {/* Small logo mark */}
          <div className="w-12 h-12 rounded-full bg-[#1e3a5f] flex items-center justify-center mb-6 shadow-md shadow-[#1e3a5f]/10">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>

          <h3 className="text-2xl font-bold text-[#0f172a] tracking-tight">
            Welcome back
          </h3>
          <p className="text-sm text-[#64748b] mt-1 font-medium">
            Sign in to continue
          </p>

          <hr className="my-6 border-slate-100" />

          {/* Form */}
          <form id="login-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                className={`w-full px-4 py-3 bg-slate-50/50 focus:bg-white border rounded-lg text-sm text-slate-800 outline-none transition-all duration-200 ${errors.username
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-[#e2e8f0] focus:border-[#1e3a5f] focus:shadow-sm'
                  }`}
                {...register('username', {
                  required: 'Username is required',
                  minLength: { value: 2, message: 'At least 2 characters required' },
                })}
              />
              {errors.username && (
                <p id="username-error" className="mt-1.5 text-xs text-red-500 font-semibold">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`w-full pl-4 pr-12 py-3 bg-slate-50/50 focus:bg-white border rounded-lg text-sm text-slate-800 outline-none transition-all duration-200 ${errors.password
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-[#e2e8f0] focus:border-[#1e3a5f] focus:shadow-sm'
                    }`}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 4, message: 'At least 4 characters required' },
                  })}
                />
                <button
                  id="toggle-password"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-red-500 font-semibold">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Sign In Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={isSubmitting}
              className="btn-submit w-full py-3 px-4 bg-[#1e3a5f] hover:bg-[#0f172a] text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 shadow-md shadow-[#1e3a5f]/10 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner />
                  <span>Signing in…</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Error Message */}
            {serverError && (
              <p id="login-error" className="text-sm text-red-500 font-semibold text-center mt-2" role="alert">
                {serverError}
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="text-center pt-8">
          <p className="text-xs text-[#94a3b8] font-semibold tracking-wide">
            © 2025 EduPortal
          </p>
        </div>
      </div>
    </div>
  )
}