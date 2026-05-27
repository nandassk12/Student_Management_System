import { useQuery } from '@tanstack/react-query'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

export default function StudentAttendancePredictor() {
  const { user } = useAuth()

  // ── Query: Fetch Attendance Predictions ──────────────────────────────────────
  const { data: predictions = [], isLoading, error } = useQuery({
    queryKey: ['studentAttendancePredictions', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await axiosInstance.get(`/attendance/predictor/${user.id}`)
      return data
    },
    enabled: !!user?.id
  })

  // Status Badge Class resolver
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Safe': return 'text-status-green bg-green-50 border-green-200 shadow-[0_1px_3px_rgba(22,163,74,0.06)]'
      case 'At Risk': return 'text-status-amber bg-amber-50 border-amber-200 shadow-[0_1px_3px_rgba(217,119,6,0.06)]'
      default: return 'text-status-red bg-red-50 border-red-200 shadow-[0_1px_3px_rgba(220,38,38,0.06)]'
    }
  }

  // Border & Glow Accents based on standing
  const getStatusCardStyle = (status) => {
    switch (status) {
      case 'Safe': return 'border-green-200 hover:border-green-300 hover:shadow-[0_8px_24px_rgba(22,163,74,0.07)]'
      case 'At Risk': return 'border-amber-200 hover:border-amber-300 hover:shadow-[0_8px_24px_rgba(217,119,6,0.07)]'
      default: return 'border-red-200 hover:border-red-300 hover:shadow-[0_8px_24px_rgba(220,38,38,0.07)]'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Attendance Predictor</h1>
        <p className="text-sm text-text-muted mt-1">Estimate remaining classes needed to sustain or cross the 75% attendance threshold.</p>
      </div>

      {/* Main predictions board */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-slate-50 border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading predictions: {error.message}
        </div>
      ) : predictions.length === 0 ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-card-border">
            📈
          </div>
          <h3 className="font-bold text-text-primary text-lg">No predictions available</h3>
          <p className="text-sm max-w-md">
            Predictions require at least one attendance record to be logged by your teachers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictions.map((pred, idx) => {
            const hasMetLimit = pred.current_percentage >= 75.0
            
            return (
              <div
                key={idx}
                className={`card bg-white p-6 border transition-all duration-300 flex flex-col justify-between space-y-6 ${getStatusCardStyle(pred.status)}`}
              >
                {/* Upper row: Course & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-text-primary tracking-tight">
                      {pred.course}
                    </h3>
                    <p className="text-[10px] text-text-muted font-bold tracking-wide uppercase mt-1">
                      Target Standing: 75% Minimum
                    </p>
                  </div>

                  <span className={`inline-block px-3 py-1 text-xs font-black rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(pred.status)}`}>
                    {pred.status}
                  </span>
                </div>

                {/* Middle row: Progress & Math Info */}
                <div className="grid grid-cols-12 gap-6 items-center">
                  {/* Current Percent block */}
                  <div className="col-span-4 text-center border-r border-card-border pr-4">
                    <span className="text-3xl font-black text-primary tracking-tight">
                      {pred.current_percentage}%
                    </span>
                    <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider mt-1">
                      Current Rate
                    </p>
                  </div>

                  {/* Attendance counts detail */}
                  <div className="col-span-8 space-y-2 text-xs font-semibold text-text-secondary">
                    <div className="flex justify-between">
                      <span className="text-text-muted font-medium">Attended Lectures:</span>
                      <span className="text-text-primary font-bold">{pred.classes_attended} hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted font-medium">Total Sessions Logged:</span>
                      <span className="text-text-primary font-bold">{pred.total_classes} hrs</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, pred.current_percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-text-muted font-bold uppercase">
                    <span>0%</span>
                    <span className="text-primary font-black">75% Target</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Forecast box */}
                <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${
                  hasMetLimit 
                    ? 'bg-green-50/20 border-green-100 text-status-green' 
                    : 'bg-red-50/20 border-red-100 text-status-red'
                }`}>
                  <span className="text-xl">{hasMetLimit ? '🎉' : '⏳'}</span>
                  <div className="text-xs">
                    {hasMetLimit ? (
                      <p className="font-bold text-green-800">
                        Awesome! You have met the 75% attendance threshold. Keep it up!
                      </p>
                    ) : (
                      <p className="font-bold text-red-800">
                        You need to attend <span className="underline font-black text-status-red">{pred.needed_for_75}</span> more consecutive lectures to reach a safe 75%.
                      </p>
                    )}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
