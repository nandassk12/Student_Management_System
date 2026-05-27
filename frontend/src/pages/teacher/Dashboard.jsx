import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@api/axios.js'
import StatCard from '@components/StatCard.jsx'
import { useAuth } from '@context/AuthContext.jsx'

// ─── Inline SVG Icons ────────────────────────────────────────────────────────
const Icons = {
  classes: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  leaves: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  attendance: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  materials: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

const fetchTeacherDashboard = async () => {
  const { data } = await axiosInstance.get('/dashboard/teacher')
  return data
}

export default function TeacherDashboard() {
  const { user } = useAuth()

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['teacherDashboard'],
    queryFn: fetchTeacherDashboard,
  })

  return (
    <div className="space-y-8 page-enter">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-sm text-text-muted mt-1">Here is an overview of your academic schedules and tasks.</p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="p-2 border border-card-border bg-white rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center text-text-secondary disabled:opacity-50"
          title="Refresh analytics"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.79" />
          </svg>
        </button>
      </div>

      {/* Stats Cards Grid */}
      {error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading dashboard stats: {error.message}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Assigned Classes"
            value={data?.assigned_classes_count}
            icon={Icons.classes}
            color="#1e3a5f"
            loading={isLoading}
          />
          <StatCard
            label="Pending Leaves"
            value={data?.pending_leave_requests_count}
            icon={Icons.leaves}
            color="#d97706"
            loading={isLoading}
          />
          <StatCard
            label="Attendance Marked Today"
            value={data?.today_attendance_count}
            icon={Icons.attendance}
            color="#16a34a"
            loading={isLoading}
          />
          <StatCard
            label="Syllabus Materials Uploaded"
            value={data?.total_materials_uploaded}
            icon={Icons.materials}
            color="#7c3aed"
            loading={isLoading}
          />
        </div>
      )}

      {/* Shortcuts & Teaching Workflow */}
      <div className="card bg-white p-6">
        <h3 className="text-base font-bold text-text-primary">Teaching Operations</h3>
        <p className="text-xs text-text-muted mt-1">Quick links to execute classroom tasks and update grades.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {[
            { label: 'Mark Attendance', path: '/teacher/attendance', icon: '📝', color: 'bg-blue-50 text-blue-700' },
            { label: 'Upload Materials', path: '/teacher/courses', icon: '📂', color: 'bg-purple-50 text-purple-700' }, // links to materials upload flow
            { label: 'Grade Students', path: '/teacher/grades', icon: '🏆', color: 'bg-green-50 text-green-700' },
            { label: 'Review Leaves', path: '/teacher/dashboard', icon: '⏳', color: 'bg-amber-50 text-amber-700' }, // leaves table
          ].map((operation, idx) => (
            <a
              key={idx}
              href={operation.path}
              className="flex flex-col items-start p-4 rounded-xl border border-card-border hover:border-primary-hover hover:bg-slate-50/50 transition-all duration-200 group"
            >
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3 ${operation.color}`}>
                {operation.icon}
              </span>
              <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary transition-colors">
                {operation.label}
              </span>
              <span className="text-xs text-text-muted mt-1 font-normal group-hover:text-text-secondary transition-colors">
                Go to page &rarr;
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
