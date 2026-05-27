/**
 * TeacherLayout
 *
 * Uses the same AppShell as AdminLayout (Sidebar + Navbar + scrollable main).
 * The Sidebar component automatically renders teacher-specific nav items
 * based on `userRole` from AuthContext — no extra configuration needed here.
 */
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Sidebar from '@components/Sidebar.jsx'
import Navbar  from '@components/Navbar.jsx'

export default function TeacherLayout() {
  const { pathname } = useLocation()
  const mainRef      = useRef(null)

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div
      style={{
        display:    'flex',
        minHeight:  '100vh',
        background: '#f8fafc',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <Sidebar />

      <div
        ref={mainRef}
        style={{
          marginLeft:    '240px',
          flex:           1,
          display:       'flex',
          flexDirection: 'column',
          minHeight:     '100vh',
          overflowY:     'auto',
          overflowX:     'hidden',
        }}
      >
        <Navbar />

        <main
          id="main-content"
          style={{ flex: 1, padding: '1.75rem 2rem' }}
        >
          <div key={pathname} style={{ animation: 'page-fade-up 200ms ease-out both' }}>
            <Outlet />
          </div>
        </main>

        <footer
          style={{
            padding:        '1rem 2rem',
            borderTop:      '1px solid #e2e8f0',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            flexShrink:     0,
          }}
        >
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
            © {new Date().getFullYear()} EduPortal — Student Management System
          </p>
          <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0 }}>v1.0.0</p>
        </footer>
      </div>

      <style>{`
        @keyframes page-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  )
}
