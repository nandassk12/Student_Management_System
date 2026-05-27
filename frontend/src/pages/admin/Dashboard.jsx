import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@api/axios.js'
import StatCard from '@components/StatCard.jsx'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

// ─── Inline SVG Icons ────────────────────────────────────────────────────────
const Icons = {
  students: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  teachers: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  collectedFees: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pendingFees: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  leaves: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  materials: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

// ─── Fetch Admin Dashboard Data ────────────────────────────────────────────────
const fetchAdminDashboard = async () => {
  const { data } = await axiosInstance.get('/dashboard/admin')
  return data
}

export default function AdminDashboard() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: fetchAdminDashboard,
  })

  // Format currency value in INR (or user default)
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  // Handle reload action
  const handleRefresh = () => {
    refetch()
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 card bg-white text-center">
        <div className="p-3 bg-red-50 text-status-red rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary">Failed to load analytics</h2>
        <p className="mt-2 text-sm text-text-muted max-w-sm">
          {error.message || 'An error occurred while fetching dashboard statistics.'}
        </p>
        <button
          onClick={handleRefresh}
          className="btn-primary mt-6 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.79M9 11l3-3m0 0l3 3m-3-3v8" />
          </svg>
          Retry
        </button>
      </div>
    )
  }

  // Data for the Recharts Bar Chart
  const chartData = [
    {
      name: 'Fee Status',
      'Collected': data?.total_fees_collected ?? 0,
      'Pending': data?.total_pending_fees ?? 0,
    }
  ]

  // Custom tooltips for chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-card-border rounded-lg shadow-modal text-xs font-semibold">
          <p className="text-text-secondary mb-2">Fees Summary</p>
          {payload.map((p, idx) => (
            <p key={idx} style={{ color: p.color }} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}: {formatCurrency(p.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-8 page-enter">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Real-time overview of college analytics and performance.</p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={isLoading || isRefetching}
          className="p-2 border border-card-border bg-white rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center text-text-secondary disabled:opacity-50"
          title="Refresh statistics"
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

      {/* ── Stat Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          label="Total Students"
          value={data?.total_students}
          icon={Icons.students}
          color="#1e3a5f"
          loading={isLoading}
        />
        <StatCard
          label="Total Teachers"
          value={data?.total_teachers}
          icon={Icons.teachers}
          color="#475569"
          loading={isLoading}
        />
        <StatCard
          label="Fees Collected"
          value={data?.total_fees_collected}
          prefix="₹"
          isAmount
          icon={Icons.collectedFees}
          color="#16a34a"
          loading={isLoading}
        />
        <StatCard
          label="Pending Fees"
          value={data?.total_pending_fees}
          prefix="₹"
          isAmount
          icon={Icons.pendingFees}
          color="#dc2626"
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
          label="Study Materials"
          value={data?.total_study_materials_uploaded}
          icon={Icons.materials}
          color="#7c3aed"
          loading={isLoading}
        />
      </div>

      {/* ── Bottom Section: Charts & Quick Links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Fees Chart */}
        <div className="lg:col-span-2 card bg-white p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-text-primary">Fees Status Comparison</h3>
            <p className="text-xs text-text-muted mt-1">Comparison between collected and pending fees.</p>
          </div>

          <div className="h-64 mt-6 flex items-center justify-center">
            {isLoading ? (
              <div className="w-full h-full flex flex-col gap-4">
                <div className="flex justify-between items-end h-48 w-full px-8 border-b border-card-border pb-2">
                  <div className="w-20 bg-slate-100 rounded-t-lg animate-pulse" style={{ height: '70%' }} />
                  <div className="w-20 bg-slate-100 rounded-t-lg animate-pulse" style={{ height: '35%' }} />
                </div>
                <div className="flex justify-between px-8 text-xs text-slate-300">
                  <span>Collected</span>
                  <span>Pending</span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tickLine={false} stroke="#94a3b8" fontSize={12} />
                  <YAxis tickLine={false} stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                  <Bar dataKey="Collected" fill="#1e3a5f" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="Pending" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column: Quick Links / Navigation */}
        <div className="card bg-white p-6">
          <h3 className="text-base font-bold text-text-primary">Management Shortcuts</h3>
          <p className="text-xs text-text-muted mt-1 font-normal">Jump directly to specific portal sections.</p>

          <div className="mt-6 space-y-3">
            {[
              { label: 'Manage Users', path: '/admin/users', icon: '👤', color: 'bg-blue-50 text-blue-700' },
              { label: 'Manage Students', path: '/admin/students', icon: '🎓', color: 'bg-green-50 text-green-700' },
              { label: 'Manage Teachers', path: '/admin/teachers', icon: '👨‍🏫', color: 'bg-amber-50 text-amber-700' },
              { label: 'Courses & Syllabus', path: '/admin/courses', icon: '📚', color: 'bg-purple-50 text-purple-700' },
              { label: 'Fees & Invoices', path: '/admin/fees', icon: '💳', color: 'bg-emerald-50 text-emerald-700' },
            ].map((link, idx) => (
              <a
                key={idx}
                href={link.path}
                className="flex items-center justify-between p-3 rounded-lg border border-card-border hover:border-primary-hover hover:bg-slate-50/50 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-md flex items-center justify-center text-base ${link.color}`}>
                    {link.icon}
                  </span>
                  <span className="text-sm font-semibold text-text-secondary group-hover:text-text-primary transition-colors">
                    {link.label}
                  </span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors transform group-hover:translate-x-0.5 duration-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
