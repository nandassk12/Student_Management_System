import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, differenceInDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'

export default function StudentLeave() {
  const queryClient = useQueryClient()

  // Form States
  const [teacherId, setTeacherId] = useState('')
  const [manualTeacherId, setManualTeacherId] = useState('')
  const [reason, setReason] = useState('')
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // ── Query: Fetch Timetable (to extract unique teachers) ───────────────────────
  const { data: timetableSlots = [] } = useQuery({
    queryKey: ['studentTimetableForLeave'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/timetable/me')
      return data
    }
  })

  // Extract unique teachers from the student's own timetable schedule
  const teachers = useMemo(() => {
    const list = []
    const seen = new Set()
    timetableSlots.forEach((slot) => {
      if (slot.teacher && !seen.has(slot.teacher.id)) {
        seen.add(slot.teacher.id)
        list.push(slot.teacher)
      }
    })
    return list
  }, [timetableSlots])

  // ── Query: Fetch Leave Balance ──────────────────────────────────────────────
  const { data: balance = { total_allowed: 15, used: 0, remaining: 15, semester: 1 }, isLoading: isBalanceLoading } = useQuery({
    queryKey: ['studentLeaveBalance'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/leave/balance')
      return data
    }
  })

  // ── Query: Fetch My Submitted Leaves ──────────────────────────────────────────
  const { data: leaves = [], isLoading: isLeavesLoading } = useQuery({
    queryKey: ['studentMyLeaves'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/leave/me')
      return data
    }
  })

  // ── Mutation: Submit Leave Request ───────────────────────────────────────────
  const createLeaveMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/leave', payload)
      return data
    },
    onSuccess: () => {
      toast.success('Leave request submitted successfully!')
      // Reset form
      setTeacherId('')
      setManualTeacherId('')
      setReason('')
      setFromDate(format(new Date(), 'yyyy-MM-dd'))
      setToDate(format(new Date(), 'yyyy-MM-dd'))

      // Refresh list
      queryClient.invalidateQueries({ queryKey: ['studentMyLeaves'] })
      queryClient.invalidateQueries({ queryKey: ['studentDashboard'] })
      queryClient.invalidateQueries({ queryKey: ['studentLeaveBalance'] })
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to submit leave request.'
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Validation error.')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    if (balance.remaining <= 0) {
      toast.error('Cannot submit request: your leave balance is fully exhausted.')
      return
    }

    const finalTeacherId = teachers.length > 0 ? Number(teacherId) : Number(manualTeacherId)

    if (!finalTeacherId || isNaN(finalTeacherId)) {
      toast.error('Please select or specify a reviewing teacher.')
      return
    }

    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters long.')
      return
    }

    if (new Date(toDate) < new Date(fromDate)) {
      toast.error('End Date cannot be before Start Date.')
      return
    }

    createLeaveMutation.mutate({
      teacher_id: finalTeacherId,
      reason: reason.trim(),
      from_date: fromDate,
      to_date: toDate
    })
  }

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'approved': return 'text-status-green bg-green-50 border-green-200'
      case 'rejected': return 'text-status-red bg-red-50 border-red-200'
      default: return 'text-status-amber bg-amber-50 border-amber-200'
    }
  }

  return (
    <div className="space-y-8 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Leave Requests</h1>
        <p className="text-sm text-text-muted mt-1">Submit leave notifications to your instructors and track their review status.</p>
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

      {/* Split Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Leave Request Form (Left) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card bg-white p-6 space-y-6">
            <h3 className="text-base font-bold text-text-primary">Apply for Leave</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Teacher Selector */}
              {teachers.length > 0 ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Reviewing Instructor</label>
                  <select
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="input bg-white font-semibold"
                    required
                  >
                    <option value="">-- Choose Instructor --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.username} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Reviewer Instructor ID</label>
                  <input
                    type="number"
                    placeholder="Enter teacher ID number..."
                    value={manualTeacherId}
                    onChange={(e) => setManualTeacherId(e.target.value)}
                    className="input font-medium"
                    required
                  />
                  <p className="text-[10px] text-text-muted font-medium">
                    Enter the ID of the instructor reviewing your request.
                  </p>
                </div>
              )}

              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="input font-medium"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="input font-medium"
                    required
                  />
                </div>
              </div>

              {/* Reason Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Reason for Leave</label>
                <textarea
                  placeholder="Explain why you are requesting absence (minimum 10 characters)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input min-h-[120px]"
                  required
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={createLeaveMutation.isPending || balance.remaining <= 0}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {balance.remaining <= 0 ? 'Leave Balance Exhausted' : createLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Leaves Listing Card (Right) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card bg-white p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">Leave History</h3>
                <p className="text-xs text-text-muted mt-0.5">Logs of your leave applications and statuses.</p>
              </div>
              <span className="text-xs font-bold text-primary bg-navy-50 px-2.5 py-1 rounded-full border border-navy-100">
                {leaves.length} Applications
              </span>
            </div>

            {isLeavesLoading ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Loading leave records...</span>
              </div>
            ) : leaves.length === 0 ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 border border-dashed border-card-border rounded-xl bg-slate-50/20">
                <span className="text-2xl">🍃</span>
                <h4 className="font-bold text-text-secondary text-sm">No applications submitted</h4>
                <p className="text-xs max-w-xs mt-1">You haven't requested any leaves of absence yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-slate-50/20">
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Reviewer</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Dates & Duration</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {leaves.map((req) => {
                      const reviewer = req.teacher
                      const duration = req.duration_days ?? differenceInDays(parseISO(req.to_date), parseISO(req.from_date)) + 1

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/20 transition-colors">
                          {/* Reviewer Details */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-[9px] font-bold">
                                {(reviewer?.full_name || reviewer?.username || '??').substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-text-primary block">
                                  {reviewer?.full_name || reviewer?.username}
                                </span>
                                <span className="text-[9px] text-text-muted font-medium mt-0.5 block truncate max-w-[140px]" title={req.reason}>
                                  Reason: {req.reason}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Dates & Duration */}
                          <td className="p-4">
                            <span className="text-xs font-bold text-text-primary block">
                              {format(parseISO(req.from_date), 'MMM dd')} - {format(parseISO(req.to_date), 'MMM dd, yyyy')}
                            </span>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-text-secondary border border-card-border">
                              {duration} {duration === 1 ? 'day' : 'days'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 text-[9px] font-black rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(req.status)}`}>
                              {req.status}
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

      </div>
    </div>
  )
}
