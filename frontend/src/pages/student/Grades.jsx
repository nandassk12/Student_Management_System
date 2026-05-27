import { useQuery } from '@tanstack/react-query'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

export default function StudentGrades() {
  const { user } = useAuth()

  // ── Query: Fetch GPA Summary ──────────────────────────────────────────────────
  const { data: gpaSummary, isLoading: isGpaLoading } = useQuery({
    queryKey: ['studentGpaSummary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data } = await axiosInstance.get(`/grades/gpa/${user.id}`)
      return data
    },
    enabled: !!user?.id
  })

  // ── Query: Fetch Course Grades list ───────────────────────────────────────────
  const { data: gradesList = [], isLoading: isGradesLoading, error } = useQuery({
    queryKey: ['studentGradesList', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await axiosInstance.get('/grades/me')
      return data
    },
    enabled: !!user?.id
  })

  // Get color pills for letter grades
  const getGradePillClass = (letter) => {
    switch (letter) {
      case 'A': return 'text-green-700 bg-green-50 border-green-200 shadow-[0_1px_2px_rgba(22,163,74,0.05)]'
      case 'B': return 'text-blue-700 bg-blue-50 border-blue-200 shadow-[0_1px_2px_rgba(37,99,235,0.05)]'
      case 'C': return 'text-yellow-700 bg-yellow-50 border-yellow-200 shadow-[0_1px_2px_rgba(202,138,4,0.05)]'
      case 'D': return 'text-orange-700 bg-orange-50 border-orange-200 shadow-[0_1px_2px_rgba(234,88,12,0.05)]'
      case 'F': return 'text-red-700 bg-red-50 border-red-200 shadow-[0_1px_2px_rgba(220,38,38,0.05)]'
      default: return 'text-slate-400 bg-slate-50 border-slate-200'
    }
  }

  const breakdownLetters = ['A', 'B', 'C', 'D', 'F']

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Academic Grades</h1>
        <p className="text-sm text-text-muted mt-1">Review your overall cumulative performance, semester GPA, and report cards.</p>
      </div>

      {/* GPA & Breakdown Card */}
      {isGpaLoading ? (
        <div className="h-32 rounded-xl bg-slate-50 border border-slate-100 animate-pulse" />
      ) : gpaSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* GPA Score */}
          <div className="card bg-white p-5 flex flex-col justify-between md:col-span-1 border-l-4 border-l-primary">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Cumulative GPA</span>
            <div className="my-2">
              <span className="text-4xl font-black text-text-primary tracking-tight">
                {gpaSummary.gpa.toFixed(2)}
              </span>
              <span className="text-sm font-bold text-text-muted"> / 4.0</span>
            </div>
            <span className="text-[10px] text-text-muted font-medium">Calculated across {gpaSummary.total_courses} courses.</span>
          </div>

          {/* Grade Distribution */}
          <div className="card bg-white p-5 md:col-span-2 flex flex-col justify-between">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2 block">Grade Distribution</span>
            <div className="grid grid-cols-5 gap-3 mt-1">
              {breakdownLetters.map((letter) => {
                const count = gpaSummary.grade_breakdown?.[letter] || 0
                return (
                  <div 
                    key={letter}
                    className="p-3 rounded-lg border border-card-border bg-slate-50/30 text-center flex flex-col justify-between"
                  >
                    <span className="text-xs font-black text-text-secondary block">{letter}</span>
                    <span className="text-lg font-black text-primary mt-1.5 block">{count}</span>
                  </div>
                )
              })}
            </div>
            <div className="text-[9px] text-text-muted italic mt-3">
              Distribution reflects letter grades recorded in study courses.
            </div>
          </div>
        </div>
      ) : null}

      {/* Report Card Table Card */}
      <div className="card bg-white overflow-hidden">
        <div className="p-4 border-b border-card-border bg-slate-50/50">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Academic record sheet</h3>
        </div>

        {isGradesLoading ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Loading grades sheet...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-status-red bg-red-50/50">
            Failed to load academic records: {error.message}
          </div>
        ) : gradesList.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            No academic grades recorded for your account yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-slate-50/20">
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-32 text-center">Semester</th>
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Course / Subject</th>
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-36">Marks (100)</th>
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center w-36">Letter Grade</th>
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-36">GPA Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {gradesList.map((record) => {
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/20 transition-colors">
                      {/* Semester */}
                      <td className="p-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-text-secondary border border-card-border">
                          Sem {record.semester}
                        </span>
                      </td>

                      {/* Course */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-black text-primary bg-navy-50 border border-navy-100 rounded uppercase">
                            {record.course?.code}
                          </span>
                          <span className="text-xs font-bold text-text-primary truncate max-w-xs">{record.course?.name}</span>
                        </div>
                      </td>

                      {/* Marks */}
                      <td className="p-4 text-center font-bold text-xs text-text-primary">
                        {record.marks}
                      </td>

                      {/* Letter Grade */}
                      <td className="p-4 text-center">
                        <span className={`inline-block px-3 py-0.5 text-xs font-black rounded-full border ${getGradePillClass(record.grade)}`}>
                          {record.grade}
                        </span>
                      </td>

                      {/* GPA Points */}
                      <td className="p-4 text-right font-semibold text-xs text-text-secondary">
                        {record.gpa_points.toFixed(1)} / 4.0
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
