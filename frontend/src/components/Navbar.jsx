import { useLocation } from 'react-router-dom'
import { useAuth } from '@context/AuthContext.jsx'
import NotificationDropdown from '@components/NotificationDropdown.jsx'

// ─── Route label map ──────────────────────────────────────────────────────────
const ROUTE_LABELS = {
  // Admin
  '/admin/dashboard':   'Dashboard',
  '/admin/users':       'User Management',
  '/admin/students':    'Students',
  '/admin/teachers':    'Teachers',
  '/admin/courses':     'Courses',
  '/admin/departments': 'Departments',
  '/admin/classes':     'Classes',
  '/admin/enrollments': 'Enrollments',
  '/admin/fees':        'Fee Management',
  '/admin/attendance':  'Attendance',
  '/admin/reports':     'Reports',
  '/admin/notice':      'Notice Board',
  '/admin/timetable':   'Timetable',
  // Teacher
  '/teacher/dashboard':  'Dashboard',
  '/teacher/courses':    'My Courses',
  '/teacher/attendance': 'Attendance',
  '/teacher/grades':     'Grades',
  '/teacher/students':   'My Students',
  '/teacher/profile':    'Profile',
  // Student
  '/student/dashboard':  'Dashboard',
  '/student/courses':    'My Courses',
  '/student/attendance': 'Attendance',
  '/student/grades':     'Grades',
  '/student/fees':       'Fees',
  '/student/profile':    'Profile',
}

// ─── Breadcrumb segment formatter ─────────────────────────────────────────────
function formatSegment(segment) {
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

// ─── Avatar initials ──────────────────────────────────────────────────────────
function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??'
}

// ─── Role chip colours ────────────────────────────────────────────────────────
const ROLE_COLORS = {
  admin:   { bg: '#dbeafe', color: '#1e40af' },
  teacher: { bg: '#dcfce7', color: '#166534' },
  student: { bg: '#fef9c3', color: '#854d0e' },
}



// ─── Logout icon ─────────────────────────────────────────────────────────────
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

// ─── Chevron icon ────────────────────────────────────────────────────────────
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

// ─── Navbar ──────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, userRole, logout } = useAuth()
  const location = useLocation()

  const pageTitle  = ROUTE_LABELS[location.pathname] ?? 'Page'
  const roleColors = ROLE_COLORS[userRole] ?? { bg: '#f1f5f9', color: '#475569' }

  // Breadcrumb segments: ['admin', 'dashboard'] etc.
  const segments = location.pathname.split('/').filter(Boolean)

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingInline: '1.75rem',
        gap: '1rem',
      }}
    >

      {/* ── Left: title + breadcrumb ── */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1px' }}>
        {/* Page title */}
        <h1
          style={{
            fontSize: '1.0625rem',
            fontWeight: '700',
            color: '#0f172a',
            margin: 0,
            lineHeight: 1.2,
            fontFamily: "'Inter', system-ui, sans-serif",
            letterSpacing: '-0.01em',
          }}
        >
          {pageTitle}
        </h1>

        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {segments.map((seg, idx) => {
            const isLast = idx === segments.length - 1
            return (
              <span
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.6875rem',
                  color: isLast ? '#1e3a5f' : '#94a3b8',
                  fontWeight: isLast ? '500' : '400',
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {idx > 0 && (
                  <span style={{ color: '#cbd5e1' }}>
                    <ChevronIcon />
                  </span>
                )}
                {formatSegment(seg)}
              </span>
            )
          })}
        </nav>
      </div>

      {/* ── Right: notification + user info ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

        {/* Notification bell */}
        <NotificationDropdown />

        {/* Divider */}
        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', flexShrink: 0 }} />

        {/* User info block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {/* Avatar */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#1e3a5f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8125rem',
              fontWeight: '700',
              color: '#93c5fd',
              flexShrink: 0,
              border: '2px solid #e2e8f0',
              letterSpacing: '-0.02em',
            }}
          >
            {initials(user?.username ?? user?.full_name ?? '')}
          </div>

          {/* Name + role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#0f172a',
                lineHeight: 1,
                fontFamily: "'Inter', system-ui, sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              {user?.username ?? 'User'}
            </span>
            {/* Role badge */}
            <span
              style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: '999px',
                fontSize: '0.625rem',
                fontWeight: '600',
                letterSpacing: '0.04em',
                textTransform: 'capitalize',
                background: roleColors.bg,
                color: roleColors.color,
                fontFamily: "'Inter', system-ui, sans-serif",
                lineHeight: 1.6,
              }}
            >
              {userRole ?? 'user'}
            </span>
          </div>

          {/* Logout button */}
          <button
            id="navbar-logout"
            onClick={() => logout()}
            aria-label="Logout"
            style={{
              marginLeft: '0.25rem',
              width: '34px',
              height: '34px',
              borderRadius: '0.5rem',
              background: 'transparent',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94a3b8',
              transition: 'background 150ms, color 150ms, border-color 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background   = '#fef2f2'
              e.currentTarget.style.color        = '#dc2626'
              e.currentTarget.style.borderColor  = '#fecaca'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background  = 'transparent'
              e.currentTarget.style.color       = '#94a3b8'
              e.currentTarget.style.borderColor = '#e2e8f0'
            }}
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </header>
  )
}
