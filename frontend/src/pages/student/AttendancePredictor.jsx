import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

export default function StudentAttendancePredictor() {
  const { user } = useAuth()

  // Simulator Inputs State
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [totalPlanned, setTotalPlanned] = useState('')
  const [planningToSkip, setPlanningToSkip] = useState('')

  // ── Query: Fetch Leave Balance ──────────────────────────────────────────────
  const { data: balance = { total_allowed: 15, used: 0, remaining: 15, semester: 1 }, isLoading: isBalanceLoading } = useQuery({
    queryKey: ['studentLeaveBalance'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/leave/balance')
      return data
    }
  })

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

  // Set default selected course
  useEffect(() => {
    if (predictions.length > 0 && !selectedCourseId) {
      setSelectedCourseId(predictions[0].course_id)
    }
  }, [predictions])

  // ── Query: Fetch Simulation Results ──────────────────────────────────────────
  const { data: simulation, isLoading: isSimulating } = useQuery({
    queryKey: ['attendanceSimulation', user?.id, selectedCourseId, totalPlanned, planningToSkip],
    queryFn: async () => {
      if (!user?.id || !selectedCourseId || totalPlanned === '' || planningToSkip === '') return null
      const { data } = await axiosInstance.get('/attendance/simulate', {
        params: {
          student_id: user.id,
          course_id: selectedCourseId,
          total_planned: Number(totalPlanned),
          planning_to_skip: Number(planningToSkip)
        }
      })
      return data
    },
    enabled: !!user?.id && !!selectedCourseId && totalPlanned !== '' && planningToSkip !== ''
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

  // Traffic Light Resolver for Simulator
  const getTrafficLightStyle = (pct, safe) => {
    if (pct >= 75.0 && safe) {
      return {
        bg: 'bg-green-50 border-green-200',
        text: 'text-status-green',
        badge: 'bg-green-100 text-green-800 border-green-200',
        icon: '🟢',
        label: 'Safe to Skip'
      }
    } else if (pct >= 60.0) {
      return {
        bg: 'bg-amber-50 border-amber-200',
        text: 'text-status-amber',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: '🟡',
        label: 'Caution / At Risk'
      }
    } else {
      return {
        bg: 'bg-red-50 border-red-200',
        text: 'text-status-red',
        badge: 'bg-red-100 text-red-800 border-red-200',
        icon: '🔴',
        label: 'Critical / Danger'
      }
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Attendance Predictor & Simulator</h1>
        <p className="text-sm text-text-muted mt-1">Estimate remaining classes needed to sustain threshold standing, or simulate future skip scenarios.</p>
      </div>

      {/* Leave Balance Card */}
      {isBalanceLoading ? (
        <div className="h-28 rounded-xl bg-slate-50 border border-slate-100 animate-pulse" />
      ) : (
        <div className="card bg-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-primary">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Leave Balance (Semester {balance.semester})</h3>
            <p className="text-2xl font-black text-text-primary">
              {balance.remaining} of {balance.total_allowed} leaves remaining
            </p>
            {balance.remaining < 3 && (
              <p className="text-xs font-bold text-status-amber flex items-center gap-1 mt-1">
                <span>⚠️</span> Warning: You have less than 3 leaves remaining for this semester.
              </p>
            )}
          </div>
          
          <div className="w-full md:w-80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-text-muted">Usage Progress</span>
              <span className="text-text-secondary">{Math.round((balance.used / balance.total_allowed) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  balance.remaining < 3 ? 'bg-status-amber' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, (balance.used / balance.total_allowed) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted font-medium">
              <span>{balance.used} Leaves Used</span>
              <span>{balance.remaining} Remaining</span>
            </div>
          </div>
        </div>
      )}

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

      {/* Scenario Simulator Card */}
      {predictions.length > 0 && (
        <div className="card bg-white p-6 border border-[#e2e8f0] shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-text-primary tracking-tight">Future Scenario Simulator</h2>
            <p className="text-xs text-text-muted mt-0.5">Model future planned classes to check if planned absences will keep your attendance above 75%.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Course Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Select Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="input py-2 px-3 text-xs bg-white font-medium border border-card-border rounded-lg outline-none focus:border-primary"
              >
                <option value="" disabled>Choose a course...</option>
                {predictions.map((p) => (
                  <option key={p.course_id} value={p.course_id}>
                    {p.course}
                  </option>
                ))}
              </select>
            </div>

            {/* Total Planned Classes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Total Planned Lectures</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 10"
                value={totalPlanned}
                onChange={(e) => {
                  const val = e.target.value
                  setTotalPlanned(val === '' ? '' : Math.max(0, parseInt(val) || 0))
                }}
                className="input py-2 px-3 text-xs bg-white font-medium border border-card-border rounded-lg outline-none focus:border-primary"
              />
            </div>

            {/* Classes Planning to Skip */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Lectures Planning to Skip</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 2"
                value={planningToSkip}
                onChange={(e) => {
                  const val = e.target.value
                  setPlanningToSkip(val === '' ? '' : Math.max(0, parseInt(val) || 0))
                }}
                className="input py-2 px-3 text-xs bg-white font-medium border border-card-border rounded-lg outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Simulation Results Display */}
          {selectedCourseId && totalPlanned !== '' && planningToSkip !== '' && (
            <div className="pt-4 border-t border-slate-100">
              {isSimulating ? (
                <div className="py-6 text-center text-text-muted flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-xs font-semibold">Running simulation...</span>
                </div>
              ) : simulation ? (
                <div className="space-y-4">
                  {/* Traffic Light Banner */}
                  {(() => {
                    const indicator = getTrafficLightStyle(simulation.predicted_percentage, simulation.safe_to_skip)
                    return (
                      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${indicator.bg}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{indicator.icon}</span>
                          <div>
                            <span className={`inline-block px-2.5 py-0.5 text-[9px] font-black rounded-full border uppercase tracking-wider ${indicator.badge}`}>
                              {indicator.label}
                            </span>
                            <p className={`text-xs font-bold mt-1 ${indicator.text}`}>
                              {simulation.warning_message}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 flex items-center sm:justify-end gap-3">
                          <div>
                            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Predicted Attendance</span>
                            <span className={`text-xl font-black tracking-tight ${indicator.text}`}>
                              {simulation.current_percentage}% → {simulation.predicted_percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Grid stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Max Lectures You Can Skip</span>
                        <span className="text-xs text-text-muted mt-1 block">Out of future classes to maintain 75%</span>
                      </div>
                      <span className="text-2xl font-black text-primary">{simulation.max_can_skip}</span>
                    </div>

                    <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Minimum Lectures You Must Attend</span>
                        <span className="text-xs text-text-muted mt-1 block">To maintain or reach the 75% mark</span>
                      </div>
                      <span className="text-2xl font-black text-primary">{simulation.min_must_attend}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
