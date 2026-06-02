import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

export default function StudentAttendance() {
  const { user } = useAuth()

  // Date filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // ── Query: Fetch Course Percentages ──────────────────────────────────────────
  const { data: percentages = [], isLoading: isPercentagesLoading } = useQuery({
    queryKey: ['studentAttendancePercentage', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await axiosInstance.get(`/attendance/percentage/${user.id}`)
      return data
    },
    enabled: !!user?.id
  })

  // ── Query: Fetch Daily Attendance Logs ───────────────────────────────────────
  const { data: logs = [], isLoading: isLogsLoading, error: logsError } = useQuery({
    queryKey: ['studentAttendanceLogs', user?.id, startDate, endDate],
    queryFn: async () => {
      if (!user?.id) return []
      const params = { limit: 100 }
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const { data } = await axiosInstance.get(`/attendance/student/${user.id}`, { params })
      return data
    },
    enabled: !!user?.id
  })

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'present': return 'text-status-green bg-green-50 border-green-200'
      case 'late': return 'text-status-amber bg-amber-50 border-amber-200'
      default: return 'text-status-red bg-red-50 border-red-200'
    }
  }

  // Clear date filters
  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
  }

  return (
    <div className="space-y-8 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">My Attendance</h1>
        <p className="text-sm text-text-muted mt-1">Review your overall attendance standing and specific session logs.</p>
      </div>

      {/* Section 1: Course Percentages Overview */}
      <div className="card bg-white p-6 space-y-6">
        <div>
          <h3 className="text-base font-bold text-text-primary">Course-wise Standing</h3>
          <p className="text-xs text-text-muted mt-0.5">Your current attendance percentage per enrolled course.</p>
        </div>

        {isPercentagesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-50 border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : percentages.length === 0 ? (
          <div className="p-8 text-center text-text-muted border border-dashed border-card-border rounded-xl">
            No attendance records found for your courses.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {percentages.map((item) => {
              const isDanger = item.attendance_percentage < 75.0
              
              return (
                <div 
                  key={item.course_id}
                  className={`p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between space-y-4 ${
                    isDanger 
                      ? 'border-status-red bg-red-50/10 shadow-[0_1px_4px_rgba(220,38,38,0.05)]' 
                      : 'border-card-border bg-white hover:border-primary/30'
                  }`}
                >
                  {/* Title & Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[9px] font-black text-primary bg-navy-50 px-1.5 py-0.5 rounded border border-navy-100 uppercase">
                        {item.course_code}
                      </span>
                      <h4 className="text-xs font-extrabold text-text-primary mt-1.5 truncate" title={item.course_name}>
                        {item.course_name}
                      </h4>
                    </div>

                    <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${
                      isDanger 
                        ? 'text-status-red bg-red-50 border-red-200' 
                        : 'text-primary bg-navy-50 border-navy-100'
                    }`}>
                      {item.attendance_percentage}%
                    </span>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          isDanger ? 'bg-status-red' : 'bg-primary'
                        }`}
                        style={{ width: `${item.attendance_percentage}%` }}
                      />
                    </div>
                    
                    {/* Course Counts */}
                    <div className="flex items-center justify-between text-[10px] text-text-secondary font-bold pt-1">
                      <span>Total: {item.total_classes} sessions</span>
                      <div className="flex gap-2">
                        <span className="text-status-green">P: {item.present_count}</span>
                        <span className="text-slate-500">L: {item.late_count}</span>
                        <span className="text-status-red">A: {item.absent_count}</span>
                      </div>
                    </div>
                  </div>

                  {/* Warning Note */}
                  {isDanger && (
                    <div className="text-[10px] font-bold text-status-red flex items-center gap-1">
                      <span>⚠️</span>
                      <span>Below 75% detainment limit!</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 2: Log History Table */}
      <div className="card bg-white overflow-hidden">
        
        {/* Table Filters Toolbar */}
        <div className="p-4 border-b border-card-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Attendance logs</h3>

          {/* Date Picker Range */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase">From</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="input py-1 px-2.5 text-xs max-w-[130px] font-medium"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase">To</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="input py-1 px-2.5 text-xs max-w-[130px] font-medium"
              />
            </div>
            
            {(startDate || endDate) && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-primary font-bold hover:underline px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table Body */}
        {isLogsLoading ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Loading session history...</span>
          </div>
        ) : logsError ? (
          <div className="p-8 text-center text-status-red bg-red-50/50">
            Failed to load attendance logs: {logsError.message}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            No attendance records found within this date range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-slate-50/20">
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-40">Session Date</th>
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Course / Subject</th>
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Marked By</th>
                  <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-36">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {logs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/20 transition-colors">
                      {/* Date */}
                      <td className="p-4 font-bold text-xs text-text-primary">
                        {format(parseISO(log.date), 'MMMM dd, yyyy')}
                      </td>
                      
                      {/* Course */}
                      <td className="p-4">
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-black text-primary bg-navy-50 border border-navy-100 rounded uppercase">
                          {log.course?.code}
                        </span>
                        <span className="text-xs font-bold text-text-primary ml-2">{log.course?.name}</span>
                      </td>

                      {/* Instructor */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-[9px] font-bold">
                            {(log.marker?.full_name || log.marker?.username || '??').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-text-secondary">
                            {log.marker?.full_name || log.marker?.username}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-right">
                        <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(log.status)}`}>
                          {log.status}
                        </span>
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
