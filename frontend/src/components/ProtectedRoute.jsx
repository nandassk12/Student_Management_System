import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@context/AuthContext.jsx'
import PageLoader from '@components/ui/PageLoader.jsx'

/**
 * ProtectedRoute
 *
 * Usage in App.jsx:
 *   <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
 *     <Route path="/admin/dashboard" element={<AdminDashboard />} />
 *   </Route>
 *
 * Behaviour:
 *  1. While the initial /auth/me check is in-flight → show PageLoader (no flash)
 *  2. Not authenticated            → redirect to /login   (preserves attempted URL)
 *  3. Authenticated, wrong role   → redirect to /unauthorized
 *  4. Authenticated, correct role → render <Outlet />
 */
export default function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthChecked, isAuthenticated, userRole } = useAuth()
  const location = useLocation()

  // ── 1. Still verifying stored token — render nothing visible ─────────────
  if (!isAuthChecked) {
    return <PageLoader />
  }

  // ── 2. Not logged in → send to /login, remember where they were going ────
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    )
  }

  // ── 3. Logged in but wrong role → /unauthorized ───────────────────────────
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{ from: location, requiredRoles: allowedRoles }}
        replace
      />
    )
  }

  // ── 4. All good → render child routes ────────────────────────────────────
  return <Outlet />
}
