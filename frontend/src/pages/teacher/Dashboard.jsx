import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@api/axios.js'
import StatCard from '@components/StatCard.jsx'
import { useAuth } from '@context/AuthContext.jsx'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts'

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
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
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

// ─── Bulk Cohort Mock Data ──────────────────────────────────────────────────
const scatterData = [
  { attendance: 95, gpa: 9.2 },
  { attendance: 88, gpa: 8.5 },
  { attendance: 72, gpa: 6.8 },
  { attendance: 60, gpa: 5.5 },
  { attendance: 80, gpa: 7.2 },
  { attendance: 90, gpa: 8.8 },
  { attendance: 65, gpa: 6.1 },
  { attendance: 75, gpa: 7.0 },
  { attendance: 98, gpa: 9.5 }
]

const subjectAttendanceData = [
  { name: 'NN & DL', rate: 88 },
  { name: 'ML Fund.', rate: 82 },
  { name: 'Comp Vision', rate: 64 }
]

const gradeDistributionData = [
  { grade: 'O', classAvg: 12, deptAvg: 15 },
  { grade: 'A', classAvg: 25, deptAvg: 20 },
  { grade: 'B', classAvg: 18, deptAvg: 22 },
  { grade: 'C', classAvg: 8, deptAvg: 10 },
  { grade: 'D/F', classAvg: 4, deptAvg: 6 }
]

export default function TeacherDashboard() {
  const { user } = useAuth()

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['teacherDashboard'],
    queryFn: fetchTeacherDashboard,
  })

  return (
    <div className="space-y-8 page-enter relative z-0 min-h-screen">
      {/* Fixed Plexus Background Watermark */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          left: '240px',
          height: '500px',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 600' width='100%25' height='100%25'%3E%3Cg stroke='%231e3a5f' stroke-width='1' stroke-opacity='0.15' fill='%231e3a5f' fill-opacity='0.15'%3E%3Ccircle cx='100' cy='500' r='4'/%3E%3Ccircle cx='250' cy='450' r='3.5'/%3E%3Ccircle cx='400' cy='530' r='5'/%3E%3Ccircle cx='550' cy='480' r='4'/%3E%3Ccircle cx='700' cy='540' r='4.5'/%3E%3Ccircle cx='850' cy='460' r='3.5'/%3E%3Ccircle cx='1000' cy='510' r='4.5'/%3E%3Ccircle cx='1150' cy='450' r='3.5'/%3E%3Ccircle cx='1300' cy='520' r='5'/%3E%3Ccircle cx='180' cy='400' r='3'/%3E%3Ccircle cx='320' cy='380' r='4'/%3E%3Ccircle cx='480' cy='420' r='3.5'/%3E%3Ccircle cx='620' cy='390' r='4.5'/%3E%3Ccircle cx='780' cy='410' r='3'/%3E%3Ccircle cx='920' cy='370' r='4'/%3E%3Ccircle cx='1080' cy='430' r='3.5'/%3E%3Ccircle cx='1220' cy='380' r='3'/%3E%3Cline x1='100' y1='500' x2='250' y2='450'/%3E%3Cline x1='100' y1='500' x2='180' y2='400'/%3E%3Cline x1='250' y1='450' x2='400' y2='530'/%3E%3Cline x1='250' y1='450' x2='320' y2='380'/%3E%3Cline x1='180' y1='400' x2='320' y2='380'/%3E%3Cline x1='400' y1='530' x2='550' y2='480'/%3E%3Cline x1='400' y1='530' x2='480' y2='420'/%3E%3Cline x1='320' y1='380' x2='480' y2='420'/%3E%3Cline x1='550' y1='480' x2='700' y2='540'/%3E%3Cline x1='550' y1='480' x2='620' y2='390'/%3E%3Cline x1='480' y1='420' x2='620' y2='390'/%3E%3Cline x1='700' y1='540' x2='850' y2='460'/%3E%3Cline x1='700' y1='540' x2='780' y2='410'/%3E%3Cline x1='620' y1='390' x2='780' y2='410'/%3E%3Cline x1='850' y1='460' x2='1000' y2='510'/%3E%3Cline x1='850' y1='460' x2='920' y2='370'/%3E%3Cline x1='780' y1='410' x2='920' y2='370'/%3E%3Cline x1='1000' y1='510' x2='1150' y2='450'/%3E%3Cline x1='1000' y1='510' x2='1080' y2='430'/%3E%3Cline x1='920' y1='370'/%3E%3Cline x1='1080' y1='430'/%3E%3Cline x1='1150' y1='450' x2='1300' y2='520'/%3E%3Cline x1='1150' y1='450' x2='1220' y2='380'/%3E%3Cline x1='1080' y1='430'/%3E%3Cline x1='1220' y1='380'/%3E%3Cline x1='1220' y1='380' x2='1300' y2='520'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundPosition: 'bottom',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% auto',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Welcome Banner */}
      <div className="flex items-center justify-between relative z-10">
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
        <div className="p-6 text-center card bg-white text-status-red font-semibold relative z-10">
          Error loading dashboard stats: {error.message}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
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

      {/* Bulk Class Cohort Analysis Panel */}
      <div className="space-y-6 relative z-10">
        <div>
          <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">Bulk Class Cohort Analysis</h3>
          <p className="text-xs text-[#475569] mt-1">Detailed metrics, distribution, and automated diagnostics for active classes.</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#d97706] rounded-lg p-4 shadow-sm">
            <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">Class Health Index</span>
            <div className="text-2xl font-bold text-[#0f172a] mt-1">78/100</div>
          </div>
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#dc2626] rounded-lg p-4 shadow-sm">
            <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">Critical Interventions</span>
            <div className="text-2xl font-bold text-[#0f172a] mt-1">14 Students</div>
          </div>
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#16a34a] rounded-lg p-4 shadow-sm">
            <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">Top Performers</span>
            <div className="text-2xl font-bold text-[#0f172a] mt-1">8 Students <span className="text-xs font-medium text-[#94a3b8]">(CGPA 9.0+)</span></div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: ScatterChart */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-sm flex flex-col">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-4">Attendance % vs GPA</span>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="attendance" name="Attendance" unit="%" stroke="#94a3b8" fontSize={10} domain={[40, 100]} />
                  <YAxis type="number" dataKey="gpa" name="GPA" stroke="#94a3b8" fontSize={10} domain={[4, 10]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Students" data={scatterData} fill="#1e3a5f" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Horizontal BarChart */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-sm flex flex-col">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-4">Subject Attendance Rates</span>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAttendanceData} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} width={70} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Grouped BarChart */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-sm flex flex-col">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-4">Grade Distribution (Class vs Dept)</span>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeDistributionData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="grade" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={24} iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="classAvg" name="Class Avg" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deptAvg" name="Dept Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Diagnostic Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Cohort Diagnostic Panel (span 2) */}
          <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">AI Cohort Diagnostic</h4>
            
            <div className="divide-y divide-[#e2e8f0] space-y-4">
              <div className="pt-0">
                <span className="text-xs font-bold text-[#475569] uppercase tracking-wider block mb-1">Bottleneck Analysis</span>
                <p className="text-sm text-[#475569] leading-relaxed">
                  Computer Vision shows a significant attendance decline of 18% over the past two weeks. This drop corresponds with active lab project deadlines, suggesting students are experiencing workload bottlenecks.
                </p>
              </div>

              <div className="pt-4">
                <span className="text-xs font-bold text-[#475569] uppercase tracking-wider block mb-1">Risk Prediction</span>
                <p className="text-sm text-[#475569] leading-relaxed">
                  Projections indicate 6 students in the current cohort are at risk of falling below the 75% attendance detention threshold by next month if the current trend persists, potentially impacting their overall CGPA.
                </p>
              </div>

              <div className="pt-4">
                <span className="text-xs font-bold text-[#475569] uppercase tracking-wider block mb-1">Recommended Action</span>
                <p className="text-sm text-[#475569] leading-relaxed">
                  Deploy selective coursework extensions for Computer Vision projects and schedule a mid-term workload alignment check-in with high-risk student profiles.
                </p>
              </div>
            </div>
          </div>

          {/* Batch Actions (span 1) */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">Batch Actions</h4>
              
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between px-3 py-2 border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-bold text-[#1e3a5f] rounded transition-colors group">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Send Attendance Warnings</span>
                  </span>
                  <span className="text-[#94a3b8]">&rarr;</span>
                </button>

                <button className="w-full flex items-center justify-between px-3 py-2 border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-bold text-[#475569] rounded transition-colors group">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Schedule Review Session</span>
                  </span>
                  <span className="text-[#94a3b8]">&rarr;</span>
                </button>

                <button className="w-full flex items-center justify-between px-3 py-2 border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-bold text-[#475569] rounded transition-colors group">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Export Cohort Report</span>
                  </span>
                  <span className="text-[#94a3b8]">&rarr;</span>
                </button>

                <button className="w-full flex items-center justify-between px-3 py-2 border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-bold text-[#475569] rounded transition-colors group">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    <span>Flag High-Risk Profiles</span>
                  </span>
                  <span className="text-[#94a3b8]">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
