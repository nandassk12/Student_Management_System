import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, differenceInDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'

export default function TeacherLeave() {
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState('review') // 'review' | 'apply'
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'approved' | 'rejected'

  // ── Apply Form States ──
  const [adminId, setAdminId] = useState('')
  const [reason, setReason] = useState('')
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // ── Query: Fetch leave requests submitted by students to this teacher ─────────
  const { data: studentLeaves = [], isLoading: isStudentLeavesLoading } = useQuery({
    queryKey: ['teacherStudentLeaveRequests'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/leave/me')
      return data
    },
    enabled: activeView === 'review'
  })

  // ── Query: Fetch list of admins (for leave review selection) ───────────────────
  const { data: admins = [] } = useQuery({
    queryKey: ['adminUsersList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/users', { params: { role: 'admin', limit: 100 } })
      return data
    },
    enabled: activeView === 'apply'
  })

  // ── Query: Fetch teacher's own submitted leaves (to admins) ────────────────────
  const { data: myLeaves = [], isLoading: isMyLeavesLoading } = useQuery({
    queryKey: ['teacherMyOwnLeaves'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/teacher/leave/me')
      return data
    },
    enabled: activeView === 'apply'
  })

  // ── Mutation: Review student leave request ───────────────────────────────────────────
  const reviewLeaveMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await axiosInstance.post(`/leave/${id}/review`, { status })
      return data
    },
    onSuccess: (data) => {
      toast.success(`Leave request was successfully ${data.status}!`)
      queryClient.invalidateQueries({ queryKey: ['teacherStudentLeaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['teacherDashboard'] })
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to update leave request status.'
      toast.error(errorMsg)
    }
  })

  // ── Mutation: Submit Teacher Leave Request (to admin) ─────────────────────────
  const createTeacherLeaveMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/teacher/leave', payload)
      return data
    },
    onSuccess: () => {
      toast.success('Leave request submitted successfully!')
      setAdminId('')
      setReason('')
      setFromDate(format(new Date(), 'yyyy-MM-dd'))
      setToDate(format(new Date(), 'yyyy-MM-dd'))
      queryClient.invalidateQueries({ queryKey: ['teacherMyOwnLeaves'] })
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to submit leave request.'
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Validation error.')
    }
  })

  // ── Mutation: Delete/Withdraw pending teacher leave request ────────────────────
  const deleteTeacherLeaveMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/teacher/leave/${id}`)
      return data
    },
    onSuccess: () => {
      toast.success('Leave request withdrawn successfully!')
      queryClient.invalidateQueries({ queryKey: ['teacherMyOwnLeaves'] })
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to withdraw request.'
      toast.error(errorMsg)
    }
  })

  const handleReview = (id, status) => {
    reviewLeaveMutation.mutate({ id, status })
  }

  const handleApplySubmit = (e) => {
    e.preventDefault()

    if (!adminId) {
      toast.error('Please select a reviewing admin.')
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

    createTeacherLeaveMutation.mutate({
      admin_id: Number(adminId),
      reason: reason.trim(),
      from_date: fromDate,
      to_date: toDate
    })
  }

  const handleWithdraw = (id) => {
    if (window.confirm('Are you sure you want to withdraw this leave request?')) {
      deleteTeacherLeaveMutation.mutate(id)
    }
  }

  // Filter student leaves based on active status tab
  const filteredStudentLeaves = studentLeaves.filter((req) => req.status === activeTab)

  const studentCounts = {
    pending: studentLeaves.filter((r) => r.status === 'pending').length,
    approved: studentLeaves.filter((r) => r.status === 'approved').length,
    rejected: studentLeaves.filter((r) => r.status === 'rejected').length,
  }

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'approved': return 'text-status-green bg-green-50 border-green-200'
      case 'rejected': return 'text-status-red bg-red-50 border-red-200'
      default: return 'text-status-amber bg-amber-50 border-amber-200'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* View Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Leave Management</h1>
          <p className="text-sm text-text-muted mt-1">
            {activeView === 'review' 
              ? 'Review, approve, or reject absence notifications submitted by students.'
              : 'Submit leave notifications to admins and track their status.'
            }
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveView('review')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeView === 'review' ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Review Student Leaves
          </button>
          <button
            onClick={() => setActiveView('apply')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeView === 'apply' ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            My Leave Requests
          </button>
        </div>
      </div>

      {/* ── View 1: Review Student Leaves ── */}
      {activeView === 'review' && (
        <div className="space-y-6">
          {/* Tabs Toolbar */}
          <div className="flex border-b border-card-border bg-white rounded-t-xl p-2 pb-0 gap-2">
            {[
              { id: 'pending', label: 'Pending Approval', count: studentCounts.pending, color: 'text-status-amber' },
              { id: 'approved', label: 'Approved', count: studentCounts.approved, color: 'text-status-green' },
              { id: 'rejected', label: 'Rejected', count: studentCounts.rejected, color: 'text-status-red' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-150 flex items-center gap-2 rounded-t-lg ${
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-navy-50/10'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 ${tab.color}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="card bg-white rounded-t-none border-t-0 overflow-hidden">
            {isStudentLeavesLoading ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Loading leave requests...</span>
              </div>
            ) : filteredStudentLeaves.length === 0 ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                <span className="text-2xl">🍃</span>
                <h4 className="font-bold text-text-secondary text-sm">No leave requests here</h4>
                <p className="text-xs max-w-xs mt-1">There are no {activeTab} leave requests awaiting your attention.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-slate-50/20">
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Student</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Reason for Leave</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">Duration</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">Status</th>
                      {activeTab === 'pending' && (
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-48">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {filteredStudentLeaves.map((req) => {
                      const student = req.student
                      const duration = req.duration_days ?? differenceInDays(parseISO(req.to_date), parseISO(req.from_date)) + 1

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/10 transition-colors">
                          <td className="p-4 align-top w-64">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-navy-50 text-primary border border-navy-100 flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                                {(student.full_name || student.username || '??').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-text-primary truncate">
                                  {student.full_name || student.username}
                                </h4>
                                <p className="text-xs text-text-muted mt-0.5 truncate">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            <p className="text-xs text-text-secondary leading-relaxed bg-slate-50/60 p-2.5 rounded-lg border border-slate-100/80 whitespace-pre-wrap">
                              {req.reason}
                            </p>
                            <p className="text-[10px] text-text-muted mt-1.5 font-medium">
                              Submitted on {format(parseISO(req.created_at), 'MMM dd, yyyy h:mm a')}
                            </p>
                          </td>
                          <td className="p-4 align-top text-center w-56">
                            <p className="text-xs font-bold text-text-primary">
                              {format(parseISO(req.from_date), 'MMM dd')} - {format(parseISO(req.to_date), 'MMM dd, yyyy')}
                            </p>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-text-secondary border border-card-border">
                              {duration} {duration === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                          <td className="p-4 align-top text-center w-28">
                            <span className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-full border uppercase tracking-wide ${getStatusBadgeStyle(req.status)}`}>
                              {req.status}
                            </span>
                          </td>
                          {activeTab === 'pending' && (
                            <td className="p-4 align-top text-right w-48">
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleReview(req.id, 'rejected')}
                                  disabled={reviewLeaveMutation.isPending}
                                  className="btn-secondary py-1.5 px-3 text-xs bg-white text-text-primary border-slate-300 hover:bg-slate-50 font-bold"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReview(req.id, 'approved')}
                                  disabled={reviewLeaveMutation.isPending}
                                  className="btn-primary py-1.5 px-3 text-xs flex items-center justify-center font-bold"
                                >
                                  Approve
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View 2: Apply for Leave (My Leaves) ── */}
      {activeView === 'apply' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Apply Form (Left) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="card bg-white p-6 space-y-6">
              <h3 className="text-base font-bold text-text-primary">Apply for Leave</h3>
              
              <form onSubmit={handleApplySubmit} className="space-y-4">
                {/* Admin Reviewer Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Reviewing Admin</label>
                  <select
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    className="input bg-white font-semibold"
                    required
                  >
                    <option value="">-- Choose Admin --</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.full_name || admin.username} ({admin.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
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

                {/* Reason */}
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

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={createTeacherLeaveMutation.isPending}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {createTeacherLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>

          {/* Leave History (Right) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="card bg-white p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary">Leave History</h3>
                  <p className="text-xs text-text-muted mt-0.5">Logs of your leave applications and statuses.</p>
                </div>
                <span className="text-xs font-bold text-primary bg-navy-50 px-2.5 py-1 rounded-full border border-navy-100">
                  {myLeaves.length} Applications
                </span>
              </div>

              {isMyLeavesLoading ? (
                <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-xs font-semibold">Loading leave records...</span>
                </div>
              ) : myLeaves.length === 0 ? (
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
                        <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                      {myLeaves.map((req) => {
                        const admin = req.admin
                        const duration = req.duration_days ?? differenceInDays(parseISO(req.to_date), parseISO(req.from_date)) + 1

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/20 transition-colors">
                            {/* Reviewer Details */}
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-[9px] font-bold">
                                  {(admin?.full_name || admin?.username || '??').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-text-primary block">
                                    {admin?.full_name || admin?.username}
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

                            {/* Withdraw action */}
                            <td className="p-4 text-right">
                              {req.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleWithdraw(req.id)}
                                  disabled={deleteTeacherLeaveMutation.isPending}
                                  className="text-xs font-bold text-status-red hover:underline"
                                >
                                  Withdraw
                                </button>
                              )}
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
      )}
    </div>
  )
}
