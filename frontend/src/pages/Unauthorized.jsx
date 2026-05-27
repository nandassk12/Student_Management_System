import { useNavigate } from 'react-router-dom'
import { useAuth } from '@context/AuthContext.jsx'

export default function Unauthorized() {
  const navigate  = useNavigate()
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-main-bg flex flex-col items-center justify-center text-center p-6 animate-fade-up">
      <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-status-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <p className="text-5xl font-extrabold text-[#e2e8f0]">403</p>
      <h1 className="mt-3 text-2xl font-bold text-text-primary">Access denied</h1>
      <p className="mt-2 text-sm text-text-muted max-w-sm">
        You don't have permission to view this page. Please contact your administrator if you think this is a mistake.
      </p>
      <div className="flex gap-3 mt-8">
        <button id="unauthorized-back" onClick={() => navigate(-1)} className="btn-secondary">
          Go back
        </button>
        <button id="unauthorized-logout" onClick={() => logout()} className="btn-primary">
          Switch account
        </button>
      </div>
    </div>
  )
}
