import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import axiosInstance, { setUnauthorizedHandler } from '@api/axios.js'

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ─── Role → dashboard route map ───────────────────────────────────────────────
const ROLE_REDIRECT = {
  admin:   '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const navigate = useNavigate()

  const [user,          setUser]          = useState(null)   // { id, username, role: { name } }
  const [isLoading,     setIsLoading]     = useState(true)   // true while verifying token on mount
  const [isAuthChecked, setIsAuthChecked] = useState(false)  // false until first /auth/me resolves

  // ── Fetch current user from /auth/me ────────────────────────────────────────
  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsLoading(false)
      setIsAuthChecked(true)
      return null
    }

    try {
      const { data } = await axiosInstance.get('/auth/me')
      setUser(data)
      return data
    } catch {
      // Token invalid / expired — clean up silently
      localStorage.removeItem('access_token')
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
      setIsAuthChecked(true)
    }
  }, [])

  // ── Verify stored token on first mount ──────────────────────────────────────
  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ username, password }) => {
    const { data } = await axiosInstance.post('/auth/login', {
      username: username,
      password: password
    }, {
      headers: { 'Content-Type': 'application/json' },
    })

    const { access_token } = data
    localStorage.setItem('access_token', access_token)

    // Fetch full user profile after storing token
    const me = await fetchMe()

    if (!me) throw new Error('Failed to retrieve user profile after login.')

    const role = me.role?.name ?? me.role
    const redirectTo = ROLE_REDIRECT[role] ?? '/login'

    toast.success(`Welcome back, ${me.username}!`)
    navigate(redirectTo, { replace: true })

    return me
  }, [fetchMe, navigate])

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback((options = {}) => {
    localStorage.removeItem('access_token')
    setUser(null)

    if (!options.silent) {
      toast.success('Logged out successfully.')
    }

    navigate('/login', { replace: true })
  }, [navigate])

  // ── Handle 401 globally (called from Axios interceptor) ──────────────────────
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('access_token')
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  // Register the handler with the Axios interceptor once it is stable
  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized)
  }, [handleUnauthorized])

  // ── Derived helpers ──────────────────────────────────────────────────────────
  const isAuthenticated = Boolean(user)
  const userRole        = user?.role?.name ?? user?.role ?? null

  const hasRole = useCallback(
    (...roles) => roles.includes(userRole),
    [userRole],
  )

  // ─── Context value ────────────────────────────────────────────────────────────
  const value = {
    // State
    user,
    isLoading,
    isAuthChecked,
    isAuthenticated,
    userRole,

    // Actions
    login,
    logout,
    fetchMe,
    handleUnauthorized,

    // Helpers
    hasRole,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}

export default AuthContext
