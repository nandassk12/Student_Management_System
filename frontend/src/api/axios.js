import axios from 'axios'

// ─── Base instance ────────────────────────────────────────────────────────────
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ─── Request interceptor — attach JWT ────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ─── Response interceptor — handle 401 globally ───────────────────────────────
//
// We can't import useAuth() here (hooks only work inside components),
// so we use a lazy-ref pattern: the AuthProvider registers its
// handleUnauthorized callback via `setUnauthorizedHandler()` on mount,
// and we call it here when a 401 is received.
//
let _handleUnauthorized = null

export function setUnauthorizedHandler(fn) {
  _handleUnauthorized = fn
}

axiosInstance.interceptors.response.use(
  // ── 2xx → pass through ───────────────────────────────────────────────────
  (response) => response,

  // ── Error → inspect status ───────────────────────────────────────────────
  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.detail
                 ?? error.response?.data?.message
                 ?? error.message
                 ?? 'An unexpected error occurred.'

    if (status === 401) {
      // Clear auth state and redirect to /login
      if (_handleUnauthorized) {
        _handleUnauthorized()
      } else {
        // Fallback if handler isn't registered yet (very early requests)
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
    }

    if (status === 403) {
      window.location.href = '/unauthorized'
    }

    // Attach a human-readable message so callers can use error.userMessage
    error.userMessage = message

    return Promise.reject(error)
  },
)

export default axiosInstance

// ─── Typed API helpers ────────────────────────────────────────────────────────
// Convenience wrappers so pages/hooks can call api.get(…) directly
// without importing and calling axiosInstance every time.

export const api = {
  get:    (url, config)       => axiosInstance.get(url, config),
  post:   (url, data, config) => axiosInstance.post(url, data, config),
  put:    (url, data, config) => axiosInstance.put(url, data, config),
  patch:  (url, data, config) => axiosInstance.patch(url, data, config),
  delete: (url, config)       => axiosInstance.delete(url, config),
}
