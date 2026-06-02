import { useAuth } from '@context/AuthContext.jsx'
import { NavLink } from 'react-router-dom'

// ─── Nav icon components (inline SVG, zero deps) ─────────────────────────────
const Icon = ({ d, d2, viewBox = '0 0 24 24' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5 flex-shrink-0"
    fill="none"
    viewBox={viewBox}
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
  </svg>
)

const Icons = {
  dashboard: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  users: <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  students: <Icon d="M12 14l9-5-9-5-9 5 9 5z" d2="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />,
  teachers: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  courses: <Icon d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  departments: <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  classes: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  enrollments: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  fees: <Icon d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />,
  attendance: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  reports: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  grades: <Icon d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" d2="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />,
  profile: <Icon d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  materials: <Icon d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />,
  timetable: <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  leave: <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  leaves: <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  notice: <Icon d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  logout: <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  ai: <Icon d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
}

// ─── Nav definitions per role ─────────────────────────────────────────────────
const NAV = {
  admin: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', to: '/admin/dashboard', icon: Icons.dashboard },
      ],
    },
    {
      section: 'People',
      items: [
        { label: 'Users', to: '/admin/users', icon: Icons.users },
        { label: 'Teacher Leaves', to: '/admin/leave', icon: Icons.leave },
      ],
    },
    {
      section: 'Academics',
      items: [
        { label: 'Courses', to: '/admin/courses', icon: Icons.courses },
        { label: 'Departments', to: '/admin/departments', icon: Icons.departments },
        { label: 'Classes', to: '/admin/classes', icon: Icons.classes },
        { label: 'Enrollments', to: '/admin/enrollments', icon: Icons.enrollments },
        { label: 'Attendance', to: '/admin/attendance', icon: Icons.attendance },
        { label: 'Timetable', to: '/admin/timetable', icon: Icons.timetable },
        { label: 'Notice Board', to: '/admin/notice', icon: Icons.notice },
      ],
    },
    {
      section: 'Finance & Logs',
      items: [
        { label: 'Fees', to: '/admin/fees', icon: Icons.fees },
        { label: 'Logs', to: '/admin/logs', icon: Icons.reports },
      ],
    },
    {
      section: 'AI Analytics',
      items: [
        { label: 'Health Dashboard', to: '/admin/ai/health', icon: Icons.ai },
        { label: 'Dept Report', to: '/admin/ai/departments', icon: Icons.ai },
        { label: 'Teacher Monitor', to: '/admin/ai/teachers', icon: Icons.ai },
      ],
    },
  ],

  teacher: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', to: '/teacher/dashboard', icon: Icons.dashboard },
        { label: 'My Profile', to: '/teacher/profile', icon: Icons.profile },
      ],
    },
    {
      section: 'Teaching',
      items: [
        { label: 'My Courses', to: '/teacher/courses', icon: Icons.courses },
        { label: 'Students', to: '/teacher/students', icon: Icons.students },
        { label: 'Attendance', to: '/teacher/attendance', icon: Icons.attendance },
        { label: 'Grades', to: '/teacher/grades', icon: Icons.grades },
        { label: 'Study Material', to: '/teacher/material', icon: Icons.materials },
        { label: 'Leave Requests', to: '/teacher/leave', icon: Icons.leaves },
        { label: 'Notice Board', to: '/teacher/notice', icon: Icons.notice },
        { label: 'Timetable', to: '/teacher/timetable', icon: Icons.timetable },
        { label: 'Progress Reports', to: '/teacher/reports', icon: Icons.reports },
      ],
    },
  ],

  student: [
    {
      section: 'Overview',
      items: [
        { label: 'Dashboard', to: '/student/dashboard', icon: Icons.dashboard },
        { label: 'My Profile', to: '/student/profile', icon: Icons.profile },
        { label: 'Notice Board', to: '/student/notice', icon: Icons.notice },
      ],
    },
    {
      section: 'Academics',
      items: [
        { label: 'My Courses', to: '/student/courses', icon: Icons.courses },
        { label: 'Leave Requests', to: '/student/leave', icon: Icons.leaves },
        { label: 'Attendance', to: '/student/attendance', icon: Icons.attendance },
        { label: 'Attendance Predictor', to: '/student/predictor', icon: Icons.reports },
        { label: 'Grades', to: '/student/grades', icon: Icons.grades },
        { label: 'CGPA Simulator', to: '/student/gpa-whatif', icon: Icons.grades },
        { label: 'Timetable', to: '/student/timetable', icon: Icons.timetable },
        { label: 'Study Material', to: '/student/material', icon: Icons.materials },
        { label: 'Progress Reports', to: '/student/reports', icon: Icons.reports },
      ],
    },
    {
      section: 'Finance',
      items: [
        { label: 'Fees', to: '/student/fees', icon: Icons.fees },
      ],
    },
  ],
}

// ─── Avatar initials helper ───────────────────────────────────────────────────
function initials(name = '') {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'
}

// ─── Role badge colours ───────────────────────────────────────────────────────
const ROLE_BADGE = {
  admin: { bg: 'rgba(30,58,95,0.9)', color: '#93c5fd' },
  teacher: { bg: 'rgba(5,78,22,0.6)', color: '#86efac' },
  student: { bg: 'rgba(120,53,15,0.6)', color: '#fcd34d' },
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, userRole, logout } = useAuth()
  const nav = NAV[userRole] ?? []
  const badge = ROLE_BADGE[userRole] ?? { bg: 'rgba(255,255,255,0.1)', color: '#fff' }

  return (
    <aside
      style={{
        width: '240px',
        minWidth: '240px',
        height: '100vh',
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 40,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
      }}
    >
      {/* ── Logo ── */}
      <div
        style={{
          padding: '1.5rem 1.25rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {/* Logo mark */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '0.625rem',
              background: '#1e3a5f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '-0.03em',
              flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '18px', height: '18px', color: '#ffffff' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div>
            <p
              style={{
                fontSize: '0.9375rem',
                fontWeight: '700',
                color: '#ffffff',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              EduPortal
            </p>
            <p
              style={{
                fontSize: '0.6875rem',
                color: '#475569',
                fontFamily: "'Inter', system-ui, sans-serif",
                marginTop: '1px',
              }}
            >
              Student Management
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav sections ── */}
      <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto', scrollbarWidth: 'none' }}>
        {nav.map((section) => (
          <div key={section.section} style={{ marginBottom: '0.25rem' }}>
            {/* Section label */}
            <p
              style={{
                fontSize: '0.6875rem',
                fontWeight: '600',
                color: '#c9d4d4ff',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.875rem 1.25rem 0.375rem',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {section.section}
            </p>

            {/* Nav items */}
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ─── Single nav item with NavLink active state ────────────────────────────────
function NavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.5625rem 1.25rem',
        marginInline: '0.5rem',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: isActive ? '600' : '400',
        color: isActive ? '#ffffff' : '#94a3b8',
        background: isActive ? '#1e3a5f' : 'transparent',
        borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
        textDecoration: 'none',
        transition: 'background 150ms, color 150ms',
        fontFamily: "'Inter', system-ui, sans-serif",
        cursor: 'pointer',
        userSelect: 'none',
      })}
      onMouseEnter={e => {
        // Only apply hover style if not currently active (active items keep their background)
        if (!e.currentTarget.classList.contains('active')) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.color = '#e2e8f0'
        }
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.classList.contains('active')) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#94a3b8'
        }
      }}
    >
      {item.icon}
      {item.label}
    </NavLink>
  )
}
