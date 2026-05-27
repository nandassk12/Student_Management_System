import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, differenceInDays, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'

export default function TeacherLeave() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'approved' | 'rejected'

  // ── Query: Fetch leave requests assigned to reviewer ─────────────────────────
  const { data: leaves = [], isLoading, error } = useQuery({
    queryKey: ['teacherLeaveRequests'],
    queryFn: async () => {
      // Fetch leaves assigned to current teacher (handled by /leave/me backend)
      const { data } = await axiosInstance.get('/leave/me')
      return data
    }
  })

  // ── Mutation: Review leave request ───────────────────────────────────────────
  const reviewLeaveMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await axiosInstance.post(`/leave/${id}/review`, { status })
      return data
    },
    onSuccess: (data) => {
      toast.success(`Leave request was successfully ${data.status}!`)
      queryClient.invalidateQueries({ queryKey: ['teacherLeaveRequests'] })
      queryClient.invalidateQueries({ queryKey: ['teacherDashboard'] })
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to update leave request status.'
      toast.error(errorMsg)
    }
  })

  const handleReview = (id, status) => {
    reviewLeaveMutation.mutate({ id, status })
  }

  // Filter leaves based on active tab
  const filteredLeaves = leaves.filter((req) => req.status === activeTab)

  // Status Counts
  const counts = {
    pending: leaves.filter((r) => r.status === 'pending').length,
    approved: leaves.filter((r) => r.status === 'approved').length,
    rejected: leaves.filter((r) => r.status === 'rejected').length,
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'text-status-green bg-green-50 border-green-200'
      case 'rejected': return 'text-status-red bg-red-50 border-red-200'
      default: return 'text-status-amber bg-amber-50 border-amber-200'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Leave Requests</h1>
        <p className="text-sm text-text-muted mt-1">Review, approve, or reject absence notifications submitted by students.</p>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex border-b border-card-border bg-white rounded-t-xl p-2 pb-0 gap-2">
        {[
          { id: 'pending', label: 'Pending Approval', count: counts.pending, color: 'text-status-amber' },
          { id: 'approved', label: 'Approved', count: counts.approved, color: 'text-status-green' },
          { id: 'rejected', label: 'Rejected', count: counts.rejected, color: 'text-status-red' },
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

      {/* Main Table Content */}
      <div className="card bg-white rounded-t-none border-t-0 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Loading leave requests...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-status-red bg-red-50/50">
            Error loading requests: {error.message}
          </div>
        ) : filteredLeaves.length === 0 ? (
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
                {filteredLeaves.map((req) => {
                  const student = req.student
                  const duration = req.duration_days ?? differenceInDays(parseISO(req.to_date), parseISO(req.from_date)) + 1

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/10 transition-colors">
                      {/* Student Info */}
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

                      {/* Reason */}
                      <td className="p-4 align-top">
                        <p className="text-xs text-text-secondary leading-relaxed bg-slate-50/60 p-2.5 rounded-lg border border-slate-100/80 whitespace-pre-wrap">
                          {req.reason}
                        </p>
                        <p className="text-[10px] text-text-muted mt-1.5 font-medium">
                          Submitted on {format(parseISO(req.created_at), 'MMM dd, yyyy h:mm a')}
                        </p>
                      </td>

                      {/* Duration / Dates */}
                      <td className="p-4 align-top text-center w-56">
                        <p className="text-xs font-bold text-text-primary">
                          {format(parseISO(req.from_date), 'MMM dd')} - {format(parseISO(req.to_date), 'MMM dd, yyyy')}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-text-secondary border border-card-border">
                          {duration} {duration === 1 ? 'day' : 'days'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4 align-top text-center w-28">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-full border uppercase tracking-wide ${getStatusBadgeClass(req.status)}`}>
                          {req.status}
                        </span>
                      </td>

                      {/* Review Buttons (Only for Pending tab) */}
                      {activeTab === 'pending' && (
                        <td className="p-4 align-top text-right w-48">
                          <div className="flex gap-2 justify-end">
                            {/* Reject: Outlined dark */}
                            <button
                              type="button"
                              onClick={() => handleReview(req.id, 'rejected')}
                              disabled={reviewLeaveMutation.isPending}
                              className="btn-secondary py-1.5 px-3 text-xs bg-white text-text-primary border-slate-300 hover:bg-slate-50 font-bold"
                            >
                              Reject
                            </button>
                            {/* Approve: Navy */}
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
  )
}
