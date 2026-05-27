import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { format } from 'date-fns'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'
import StatCard from '@components/StatCard.jsx'

export default function StudentDashboard() {
  const { user } = useAuth()

  // ── Query: Fetch Student Dashboard Analytics ───────────────────────────────────
  const { data: dashboard, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['studentDashboard'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dashboard/student')
      return data
    }
  })

  // ── Query: Fetch All Grades (to calculate GPA trend per semester) ─────────────
  const { data: grades = [], isLoading: isGradesLoading } = useQuery({
    queryKey: ['studentGradesTrend'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/grades/me')
      return data
    }
  })

  // ── Helper Icon Components ──────────────────────────────────────────────────
  const Icons = {
    attendance: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    gpa: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    fees: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    classes: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  // Calculate Overall Attendance Rate
  const overallAttendance = (() => {
    const list = dashboard?.attendance_percentage_per_course || []
    if (list.length === 0) return 0
    const totalPct = list.reduce((sum, c) => sum + c.attendance_percentage, 0)
    return Math.round(totalPct / list.length)
  })()

  // Format Attendance Data for Donut Chart
  const attendanceDonutData = [
    { name: 'Attended', value: overallAttendance },
    { name: 'Absent', value: Math.max(0, 100 - overallAttendance) }
  ]

  // Calculate GPA Trend dynamically by Semester from grades feed
  const gpaTrend = (() => {
    if (!grades || grades.length === 0) return []
    // Group points by semester
    const semGrades = {}
    grades.forEach((g) => {
      const sem = g.semester
      if (!semGrades[sem]) semGrades[sem] = []
      semGrades[sem].push(g.gpa_points)
    })
    
    // Format into sorted array
    return Object.keys(semGrades)
      .map((sem) => {
        const points = semGrades[sem]
        const avg = points.reduce((acc, val) => acc + val, 0) / points.length
        return {
          name: `Sem ${sem}`,
          gpa: parseFloat(avg.toFixed(2))
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  })()

  // Helper formatting for time strings
  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let hours = parseInt(parts[0], 10)
    const minutes = parts[1]
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${hours}:${minutes} ${ampm}`
  }

  const todayName = format(new Date(), 'EEEE') // e.g. "Wednesday"

  return (
    <div className="space-y-8 page-enter">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">
          Welcome back, {user?.username}!
        </h1>
        <p className="text-sm text-text-muted mt-1">Here is a quick snapshot of your academic progress and schedule.</p>
      </div>

      {/* Analytics Stat Cards Grid */}
      {dashboardError ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading dashboard stats: {dashboardError.message}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Attendance Rate"
            value={overallAttendance}
            suffix="%"
            icon={Icons.attendance}
            color="#1e3a5f"
            loading={isDashboardLoading}
          />
          <StatCard
            label="Cumulative GPA"
            value={dashboard?.current_gpa || 0}
            suffix=" / 4.0"
            icon={Icons.gpa}
            color="#16a34a"
            loading={isDashboardLoading}
          />
          <StatCard
            label="Pending Fees"
            value={dashboard?.pending_fees_amount || 0}
            prefix="₹"
            icon={Icons.fees}
            color="#dc2626"
            loading={isDashboardLoading}
          />
          <StatCard
            label="Today's Classes"
            value={dashboard?.today_timetable?.length || 0}
            icon={Icons.classes}
            color="#7c3aed"
            loading={isDashboardLoading}
          />
        </div>
      )}

      {/* Split Charts and Agenda Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Attendance Donut (Left-ish) */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="card bg-white p-6 space-y-6 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary">Attendance Distribution</h3>
              <p className="text-xs text-text-muted mt-0.5">Overall presence rate across all courses.</p>
            </div>

            <div className="relative w-44 h-44 mx-auto flex items-center justify-center my-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceDonutData}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#1e3a5f" />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Percentage']} 
                    contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-primary leading-none">{overallAttendance}%</span>
                <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1">Present</span>
              </div>
            </div>

            {/* Attendance Legends */}
            <div className="flex items-center justify-center gap-6 text-xs font-semibold text-text-secondary">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span>Present ({overallAttendance}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>Absent ({Math.max(0, 100 - overallAttendance)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* GPA Trend Line Chart (Middle) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="card bg-white p-6 space-y-6 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary">GPA Progression</h3>
              <p className="text-xs text-text-muted mt-0.5">Your academic GPA trend per semester.</p>
            </div>

            {isGradesLoading ? (
              <div className="h-48 flex items-center justify-center text-xs text-text-muted">
                Loading grades data...
              </div>
            ) : gpaTrend.length === 0 ? (
              <div className="h-48 border border-dashed border-card-border rounded-lg flex flex-col items-center justify-center text-center p-4">
                <span className="text-xl">🎓</span>
                <h4 className="text-xs font-bold text-text-secondary mt-1">No performance records</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Semester GPA details will populate when grades are inputted.</p>
              </div>
            ) : (
              <div className="h-48 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gpaTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis 
                      domain={[0, 4.0]} 
                      ticks={[0, 1.0, 2.0, 3.0, 4.0]}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <Tooltip 
                      formatter={(value) => [`${value} / 4.0`, 'Semester GPA']} 
                      contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gpa" 
                      stroke="#1e3a5f" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#1e3a5f', strokeWidth: 1 }}
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="text-[10px] text-text-muted text-center italic mt-2">
              Note: GPA averages are calculated out of a 4.0 maximum scale.
            </div>
          </div>
        </div>

        {/* Today's Schedule Agenda (Right) */}
        <div className="lg:col-span-3 flex flex-col">
          <div className="card bg-white p-6 space-y-6 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary">Today's Lectures</h3>
              <p className="text-xs text-text-muted mt-0.5">Your schedule for {todayName}.</p>
            </div>

            {isDashboardLoading ? (
              <div className="space-y-4 flex-1 mt-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-slate-50 border border-slate-100 animate-pulse" />
                ))}
              </div>
            ) : !dashboard?.today_timetable || dashboard.today_timetable.length === 0 ? (
              <div className="flex-1 border border-dashed border-card-border rounded-lg flex flex-col items-center justify-center text-center p-4 py-8 my-4">
                <span className="text-xl">🌴</span>
                <h4 className="text-xs font-bold text-text-secondary mt-1">No Lectures Today</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Enjoy your day off or self-study time!</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-56 mt-4 pr-1 scrollbar-thin">
                {dashboard.today_timetable.map((slot) => (
                  <div 
                    key={slot.id}
                    className="p-3 rounded-lg border border-card-border bg-white hover:border-primary/30 transition-all duration-150 flex items-start gap-2.5 justify-between"
                  >
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-primary bg-navy-50 px-1.5 py-0.5 rounded border border-navy-100 uppercase">
                        {slot.course?.code}
                      </span>
                      <h4 className="text-xs font-extrabold text-text-primary truncate mt-1" title={slot.course?.name}>
                        {slot.course?.name}
                      </h4>
                      <p className="text-[10px] text-text-muted mt-0.5 truncate flex items-center gap-1 font-medium">
                        <span>🚪 {slot.room}</span> | <span>👤 {slot.teacher?.full_name || slot.teacher?.username}</span>
                      </p>
                    </div>
                    
                    <span className="text-[9px] font-bold text-text-secondary bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                      {formatTime(slot.start_time)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] text-primary hover:underline font-bold text-right mt-2">
              <a href="/student/timetable">Full Timetable &rarr;</a>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
