import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'
import { ConfirmModal } from '@components/Modal.jsx'

export default function TeacherNotice() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Form States
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetRole, setTargetRole] = useState('all') // 'all' | 'student' | 'teacher'
  const [selectedClass, setSelectedClass] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  // Delete State
  const [deletingNotice, setDeletingNotice] = useState(null)

  // ── Query: Fetch Classes (for cohort targeting) ────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['teacherClassesNotices'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/classes', { params: { limit: 100 } })
      return data
    }
  })

  // ── Query: Fetch Notices ───────────────────────────────────────────────────────
  const { data: notices = [], isLoading: isNoticesLoading } = useQuery({
    queryKey: ['teacherNoticesBoard'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/notice', { params: { limit: 100 } })
      return data
    }
  })

  // ── Mutation: Create Notice ────────────────────────────────────────────────────
  const createNoticeMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/notice', payload)
      return data
    },
    onSuccess: () => {
      toast.success('Notice published successfully!')
      // Reset form
      setTitle('')
      setContent('')
      setTargetRole('all')
      setSelectedClass('')
      
      // Refresh notices feed
      queryClient.invalidateQueries({ queryKey: ['teacherNoticesBoard'] })
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to publish notice.'
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Validation error.')
    }
  })

  // ── Mutation: Delete Notice ────────────────────────────────────────────────────
  const deleteNoticeMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/notice/${id}`)
      return data
    },
    onSuccess: (data) => {
      toast.success(data.detail ?? 'Notice deleted successfully!')
      queryClient.invalidateQueries({ queryKey: ['teacherNoticesBoard'] })
      setDeletingNotice(null)
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.detail ?? 'Failed to delete notice.'
      toast.error(errorMsg)
      setDeletingNotice(null)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!title.trim() || title.trim().length < 3) {
      toast.error('Title must be at least 3 characters.')
      return
    }

    if (!content.trim()) {
      toast.error('Notice content cannot be empty.')
      return
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      target_role: targetRole,
      class_id: selectedClass ? Number(selectedClass) : null
    }

    createNoticeMutation.mutate(payload)
  }

  // Audience Pill Class Helper
  const getAudienceBadgeStyle = (role) => {
    switch (role) {
      case 'teacher': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'student': return 'bg-blue-50 text-blue-700 border-blue-200'
      default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="space-y-8 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Notice Board</h1>
        <p className="text-sm text-text-muted mt-1">Broadcast notifications, schedules, or announcements to students and teachers.</p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Notice Form Panel (Left) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card bg-white p-6 space-y-6">
            <h3 className="text-base font-bold text-text-primary">Publish a Notice</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Notice Title</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule for Mid-Term Exams"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input font-medium"
                  required
                />
              </div>

              {/* Target Role Audience */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Target Audience</label>
                <select
                  value={targetRole}
                  onChange={(e) => {
                    setTargetRole(e.target.value)
                    if (e.target.value === 'teacher') {
                      setSelectedClass('') // Disable class targeting for teachers
                    }
                  }}
                  className="input bg-white font-semibold"
                  required
                >
                  <option value="all">Everyone (All Roles)</option>
                  <option value="student">Students Only</option>
                  <option value="teacher">Teachers Only</option>
                </select>
              </div>

              {/* Class Target (Optional, only for students/everyone) */}
              {targetRole !== 'teacher' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Target Class (Optional)
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="input bg-white font-semibold"
                    disabled={isClassesLoading}
                  >
                    <option value="">All Batches / Classes</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} (Semester {cls.semester})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted">
                    If selected, only students enrolled in this class will see the notice.
                  </p>
                </div>
              )}

              {/* Content Body */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Notice Details</label>
                <textarea
                  placeholder="Write the full announcement here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input min-h-[160px]"
                  required
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={createNoticeMutation.isPending}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {createNoticeMutation.isPending ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </form>
          </div>
        </div>

        {/* Notices Board Listings Feed (Right) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card bg-white p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">Notice Board Feed</h3>
                <p className="text-xs text-text-muted mt-0.5">Academic broadcasts and active circulars.</p>
              </div>
              <span className="text-xs font-bold text-primary bg-navy-50 px-2.5 py-1 rounded-full border border-navy-100">
                {notices.length} Published
              </span>
            </div>

            {isNoticesLoading ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Loading notices...</span>
              </div>
            ) : notices.length === 0 ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 border border-dashed border-card-border rounded-xl bg-slate-50/20">
                <span className="text-2xl">📢</span>
                <h4 className="font-bold text-text-secondary text-sm">Notice Board is empty</h4>
                <p className="text-xs max-w-xs mt-1">There are no notices active in your workspace.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notices.map((notice) => {
                  const isAuthor = notice.author_id === user?.id

                  return (
                    <div 
                      key={notice.id}
                      className="p-5 rounded-xl border border-card-border bg-white hover:border-slate-300 hover:shadow-card transition-all duration-200"
                    >
                      {/* Top Bar: Author & Meta */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {/* Avatar Circle */}
                          <div className="w-9 h-9 rounded-full bg-navy-50 text-primary border border-navy-100 flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                            {(notice.author?.full_name || notice.author?.username || '??').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-text-primary">
                              {notice.author?.full_name || notice.author?.username}
                            </h4>
                            <p className="text-[10px] text-text-muted font-semibold mt-0.5">
                              {format(parseISO(notice.created_at), 'MMMM dd, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        {isAuthor && (
                          <button
                            type="button"
                            onClick={() => setDeletingNotice(notice)}
                            className="p-1 text-text-muted hover:text-status-red rounded-md hover:bg-red-50 transition-colors"
                            title="Delete announcement"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-extrabold text-text-primary mt-4 tracking-tight leading-snug">
                        {notice.title}
                      </h4>

                      {/* Content Body */}
                      <p className="text-xs text-text-secondary leading-relaxed mt-2 whitespace-pre-wrap">
                        {notice.content}
                      </p>

                      {/* Badges Footer */}
                      <div className="mt-4 pt-3 border-t border-card-border/60 flex flex-wrap gap-2">
                        {/* Target Role Badge */}
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getAudienceBadgeStyle(notice.target_role)}`}>
                          Audience: {notice.target_role}
                        </span>

                        {/* Cohort Class Badge */}
                        {notice.class_ && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            Class: {notice.class_.name}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingNotice}
        onClose={() => setDeletingNotice(null)}
        onConfirm={() => deleteNoticeMutation.mutate(deletingNotice.id)}
        title="Delete Notice Board Entry"
        message={`Are you sure you want to permanently delete the announcement '${deletingNotice?.title}'? This will remove it from the notice board feed for all students and teachers.`}
        confirmLabel="Delete announcement"
        danger
        loading={deleteNoticeMutation.isPending}
      />
    </div>
  )
}
