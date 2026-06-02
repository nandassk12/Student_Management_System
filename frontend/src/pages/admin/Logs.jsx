import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import axiosInstance from '@api/axios.js'
import StatCard from '@components/StatCard.jsx'

export default function AdminLogs() {
  // Fetch Admin Dashboard summary
  const { data: dashboard, isLoading: isDashLoading } = useQuery({
    queryKey: ['adminReportsDashboard'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dashboard/admin')
      return data
    }
  })

  // Fetch last 10 Attendance records
  const { data: attendance = [], isLoading: isAttendanceLoading } = useQuery({
    queryKey: ['adminReportsAttendance'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/attendance', { params: { limit: 10 } })
      return data
    }
  })

  // Fetch last 10 Grade records
  const { data: grades = [], isLoading: isGradesLoading } = useQuery({
    queryKey: ['adminReportsGrades'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/grades', { params: { limit: 10 } })
      return data
    }
  })

  // Format currency value in INR
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val ?? 0)
  }

  // Icons for summary cards
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
    )
  }

  return (
    <div className="space-y-8 page-enter">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Academic & Finance Logs</h1>
        <p className="text-sm text-[#64748b] mt-1">Unified view of college performance, audit trails, and student tracking logs.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Students"
          value={dashboard?.total_students}
          icon={Icons.students}
          color="#1e3a5f"
          loading={isDashLoading}
        />
        <StatCard
          label="Total Teachers"
          value={dashboard?.total_teachers}
          icon={Icons.teachers}
          color="#475569"
          loading={isDashLoading}
        />
        <StatCard
          label="Fees Collected"
          value={dashboard?.total_fees_collected ? formatCurrency(dashboard.total_fees_collected) : '₹0'}
          icon={Icons.collectedFees}
          color="#16a34a"
          loading={isDashLoading}
        />
        <StatCard
          label="Pending Fees"
          value={dashboard?.total_pending_fees ? formatCurrency(dashboard.total_pending_fees) : '₹0'}
          icon={Icons.pendingFees}
          color="#dc2626"
          loading={isDashLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Attendance Log Card */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#e2e8f0] bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">Recent Attendance Audits (Last 10)</h3>
            <span className="text-xs font-bold text-[#1e3a5f] bg-blue-50 px-2 py-0.5 rounded-full">Real-time</span>
          </div>

          {isAttendanceLoading ? (
            <div className="p-6 space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-50 rounded" />
              ))}
            </div>
          ) : attendance.length === 0 ? (
            <div className="p-12 text-center text-[#64748b] text-xs">No attendance audits logged.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/20 border-b border-[#e2e8f0]">
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase">Student</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase">Course</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase">Date</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {attendance.map((att, idx) => (
                    <tr key={att.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/50 transition-colors`}>
                      <td className="p-4 text-xs font-semibold text-[#0f172a]">{att.student?.username}</td>
                      <td className="p-4 text-xs text-[#64748b] truncate max-w-[140px]">{att.course?.name}</td>
                      <td className="p-4 text-xs text-[#64748b]">
                        {att.date ? format(parseISO(att.date), 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-black rounded-full border uppercase tracking-wider ${
                          att.status === 'present'
                            ? 'text-green-600 bg-green-50 border-green-200'
                            : att.status === 'absent'
                            ? 'text-red-600 bg-red-50 border-red-200'
                            : 'text-amber-600 bg-amber-50 border-amber-200'
                        }`}>
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Grades Log Card */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#e2e8f0] bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">Recent Grades Audits (Last 10)</h3>
            <span className="text-xs font-bold text-[#1e3a5f] bg-blue-50 px-2 py-0.5 rounded-full">Academic</span>
          </div>

          {isGradesLoading ? (
            <div className="p-6 space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-50 rounded" />
              ))}
            </div>
          ) : grades.length === 0 ? (
            <div className="p-12 text-center text-[#64748b] text-xs">No grades logged.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/20 border-b border-[#e2e8f0]">
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase">Student</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase">Course</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase text-center">Marks</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase text-right">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {grades.map((g, idx) => (
                    <tr key={g.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/50 transition-colors`}>
                      <td className="p-4 text-xs font-semibold text-[#0f172a]">{g.student?.username}</td>
                      <td className="p-4 text-xs text-[#64748b] truncate max-w-[140px]">{g.course?.name}</td>
                      <td className="p-4 text-xs text-[#64748b] text-center font-bold">{g.marks}/100</td>
                      <td className="p-4 text-right">
                        <span className="inline-block px-2.5 py-0.5 text-xs font-black rounded bg-slate-100 text-[#1e3a5f] border border-slate-200">
                          {g.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
