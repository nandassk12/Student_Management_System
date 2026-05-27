import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'

import App from './App.jsx'
import { AuthProvider } from '@context/AuthContext.jsx'
import './index.css'

// ─── React Query Client ───────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          1000 * 60 * 5,  // 5 minutes
      gcTime:             1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry:              1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ─── Hide initial loader once React mounts ────────────────────────────────────
const loader = document.getElementById('initial-loader')
if (loader) {
  loader.classList.add('hidden')
  setTimeout(() => loader.remove(), 350)
}

// ─── Root Render ──────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />

          {/* ── Toast notifications ── */}
          <Toaster
            position="top-right"
            gutter={8}
            toastOptions={{
              duration: 3000,
              style: {
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize:   '0.875rem',
                fontWeight: '500',
                color:      '#0f172a',
                background: '#ffffff',
                border:     '1px solid #e2e8f0',
                borderRadius: '0.625rem',
                boxShadow:  '0 4px 12px 0 rgba(0,0,0,0.10)',
                padding:    '12px 16px',
              },
              success: {
                iconTheme: { primary: '#16a34a', secondary: '#ffffff' },
                style: { borderLeft: '4px solid #16a34a' },
              },
              error: {
                iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
                style: { borderLeft: '4px solid #dc2626' },
              },
              loading: {
                iconTheme: { primary: '#1e3a5f', secondary: '#ffffff' },
                style: { borderLeft: '4px solid #1e3a5f' },
              },
            }}
          />
        </AuthProvider>

        {/* React Query Devtools — only visible in development */}
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
