import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Modal, { ConfirmModal } from '@components/Modal.jsx'
import StatusBadge from '@components/StatusBadge.jsx'

export default function AdminNotice() {
  const queryClient = useQueryClient()

  // States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deletingNotice, setDeletingNotice] = useState(null)

  // Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    watch: watchCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate }
  } = useForm({
    defaultValues: {
      title: '',
      content: '',
      target_role: 'all',
      class_id: ''
    }
  })

  // Watch target_role to conditionally show Class ID selector
  const watchTargetRole = watchCreate('target_role')

  // ── Query: List Notices ──────────────────────────────────────────────────────
  const { data: notices = [], isLoading: isNoticesLoading, error } = useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/notice', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Query: List Classes ──────────────────────────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/classes', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Mutation: Create Notice ──────────────────────────────────────────────────
  const createNoticeMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/notice', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      toast.success(`Announcement '${data.title}' posted successfully!`)
      setIsCreateOpen(false)
      resetCreate()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to post announcement.'
      toast.error(typeof detail === 'string' ? detail : 'Validation error.')
    }
  })

  // ── Mutation: Delete Notice ──────────────────────────────────────────────────
  const deleteNoticeMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/notice/${id}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      toast.success(data.detail ?? 'Announcement deleted successfully!')
      setDeletingNotice(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to delete announcement.'
      toast.error(detail)
    }
  })

  // Handlers
  const onCreateSubmit = (data) => {
    const payload = {
      title: data.title,
      content: data.content,
      target_role: data.target_role,
      class_id: data.target_role === 'student' && data.class_id ? Number(data.class_id) : null
    }
    createNoticeMutation.mutate(payload)
  }

  const handleDelete = () => {
    deleteNoticeMutation.mutate(deletingNotice.id)
  }

  // Format Date
  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Target role badge coloring mappings
  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'student': return 'amber'
      case 'teacher': return 'green'
      default: return 'blue'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Notice Board</h1>
          <p className="text-sm text-text-muted mt-1">Broadcast important announcements, updates, and class alerts.</p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true)
            resetCreate()
          }}
          className="btn-primary flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          Post Notice
        </button>
      </div>

      {/* Main notice display */}
      {isNoticesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card bg-white p-6 space-y-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-6 bg-slate-200 rounded w-3/4" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-200 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading notices: {error.message}
        </div>
      ) : notices.length === 0 ? (
        <div className="p-16 text-center card bg-white space-y-3">
          <div className="text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 00-2-2m-2 3a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-text-primary">No notices posted</h3>
          <p className="text-xs text-text-muted">Notice board is currently clean. Click the button above to broadcast an update.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="card bg-white p-6 flex flex-col justify-between hover:scale-[1.01] hover:shadow-card-hover transition-all duration-200 relative group border border-card-border"
            >
              {/* Badges and meta */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={notice.target_role}
                    variant={getRoleBadgeVariant(notice.target_role)}
                    label={notice.target_role === 'all' ? 'To: Everyone' : `To: ${notice.target_role}s`}
                    dot={false}
                    size="sm"
                  />
                  {notice.class_ && (
                    <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                      Class: {notice.class_.name}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted font-semibold">
                  {formatDate(notice.created_at)}
                </span>
              </div>

              {/* Title & Body */}
              <div className="flex-1 space-y-2 mb-6">
                <h3 className="text-base font-bold text-text-primary leading-tight group-hover:text-primary transition-colors">
                  {notice.title}
                </h3>
                <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed font-normal">
                  {notice.content}
                </p>
              </div>

              {/* Footer Author & Action */}
              <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                <span className="text-xs text-text-muted font-medium flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-text-secondary uppercase font-bold">
                    {notice.author.username[0]}
                  </span>
                  Posted by <strong className="text-text-secondary font-semibold">{notice.author.username}</strong>
                </span>

                <button
                  onClick={() => setDeletingNotice(notice)}
                  className="p-1.5 text-text-muted hover:text-status-red hover:bg-red-50 rounded-lg transition-colors duration-150"
                  title="Delete notice"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── POST NOTICE MODAL ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Post Announcement"
        description="Publish an alert or notice on the bulletin board."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="btn-secondary"
              disabled={isSubmittingCreate}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-notice-form"
              className="btn-primary"
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? 'Posting...' : 'Post Notice'}
            </button>
          </>
        }
      >
        <form
          id="create-notice-form"
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4"
        >
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Announcement Title</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. End Semester Exam Timetable Released"
              {...registerCreate('title', {
                required: 'Title is required',
                minLength: { value: 3, message: 'Title must be at least 3 characters' }
              })}
            />
            {errorsCreate.title && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.title.message}</p>
            )}
          </div>

          {/* Content */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Content Body</label>
            <textarea
              className="input min-h-[120px] py-2"
              placeholder="Write the full announcement text here..."
              {...registerCreate('content', { required: 'Content body is required' })}
            />
            {errorsCreate.content && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.content.message}</p>
            )}
          </div>

          {/* Target Role */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Target Audience</label>
            <select
              className="input bg-white"
              {...registerCreate('target_role', { required: true })}
            >
              <option value="all">Everyone</option>
              <option value="teacher">Teachers Only</option>
              <option value="student">Students Only</option>
            </select>
          </div>

          {/* Class (Conditionally shown if Student Only) */}
          {watchTargetRole === 'student' && (
            <div className="space-y-1 animate-fade-up">
              <label className="text-xs font-bold text-text-secondary">
                Filter by Class <span className="text-text-muted font-normal">(Optional — blank targets all classes)</span>
              </label>
              <select
                className="input bg-white"
                {...registerCreate('class_id')}
                disabled={isClassesLoading}
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>
      </Modal>

      {/* ── DELETE NOTICE CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!deletingNotice}
        onClose={() => setDeletingNotice(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message={`Are you sure you want to permanently delete the notice '${deletingNotice?.title}'? This will remove it from the bulletin board for all targeted users.`}
        confirmLabel="Delete"
        danger
        loading={deleteNoticeMutation.isPending}
      />
    </div>
  )
}
