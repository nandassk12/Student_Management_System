import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Modal, { ConfirmModal } from '@components/Modal.jsx'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function AdminTimetable() {
  const queryClient = useQueryClient()

  // States
  const [selectedClassId, setSelectedClassId] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deletingSlot, setDeletingSlot] = useState(null)

  // Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate }
  } = useForm({
    defaultValues: {
      class_id: '',
      course_id: '',
      teacher_id: '',
      day: 'Monday',
      start_time: '09:00',
      end_time: '10:30',
      room: ''
    }
  })

  // ── Query: List Classes (for dropdown selector & form) ────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/classes', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Query: List Courses (for form selector) ──────────────────────────────────
  const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Query: List Teachers (for form selector) ─────────────────────────────────
  const { data: teachers = [], isLoading: isTeachersLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/users', {
        params: { role: 'teacher', limit: 100 }
      })
      return data
    }
  })

  // ── Query: Timetable slots for the selected Class ────────────────────────────
  const { data: timetableSlots = [], isLoading: isTimetableLoading, error: timetableError } = useQuery({
    queryKey: ['timetable', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return []
      const { data } = await axiosInstance.get(`/timetable/class/${selectedClassId}`)
      return data
    },
    enabled: !!selectedClassId
  })

  // ── Mutation: Create Timetable Slot ──────────────────────────────────────────
  const createSlotMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/timetable', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable', selectedClassId] })
      toast.success('Timetable slot scheduled successfully!')
      setIsCreateOpen(false)
      resetCreate()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to create timetable slot.'
      toast.error(typeof detail === 'string' ? detail : 'Clashing schedule detected.')
    }
  })

  // ── Mutation: Delete Timetable Slot ──────────────────────────────────────────
  const deleteSlotMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/timetable/${id}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timetable', selectedClassId] })
      toast.success(data.detail ?? 'Timetable slot deleted successfully!')
      setDeletingSlot(null)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to delete timetable slot.'
      toast.error(detail)
    }
  })

  // Handlers
  const onCreateSubmit = (data) => {
    // Append seconds ":00" to time strings as backend expects HH:MM:SS format
    const formatTimeWithSeconds = (t) => {
      if (!t) return ''
      return t.split(':').length === 2 ? `${t}:00` : t
    }

    createSlotMutation.mutate({
      class_id: Number(data.class_id),
      course_id: Number(data.course_id),
      teacher_id: Number(data.teacher_id),
      day: data.day,
      start_time: formatTimeWithSeconds(data.start_time),
      end_time: formatTimeWithSeconds(data.end_time),
      room: data.room
    })
  }

  const handleDelete = () => {
    deleteSlotMutation.mutate(deletingSlot.id)
  }

  const openCreateModal = () => {
    setIsCreateOpen(true)
    resetCreate({
      class_id: selectedClassId,
      course_id: '',
      teacher_id: '',
      day: 'Monday',
      start_time: '09:00',
      end_time: '10:30',
      room: ''
    })
  }

  // Format display times (HH:MM)
  const formatTimeDisplay = (timeString) => {
    if (!timeString) return '—'
    const parts = timeString.split(':')
    return `${parts[0]}:${parts[1]}`
  }

  // Group slots by Day
  const slotsByDay = DAYS.reduce((acc, day) => {
    acc[day] = timetableSlots.filter((slot) => slot.day.toLowerCase() === day.toLowerCase())
    return acc
  }, {})

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Timetable</h1>
          <p className="text-sm text-text-muted mt-1">Design daily schedules, lecture hours, teacher assignments, and classroom bookings.</p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Time Slot
        </button>
      </div>

      {/* Class Selector Panel */}
      <div className="p-4 card bg-white flex items-center gap-4">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Class:</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="input bg-white max-w-sm"
          disabled={isClassesLoading}
        >
          <option value="">-- Choose Class --</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      {/* Weekly Grid View */}
      {selectedClassId ? (
        timetableError ? (
          <div className="p-6 text-center card bg-white text-status-red font-semibold">
            Error loading schedule: {timetableError.message}
          </div>
        ) : isTimetableLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {DAYS.slice(0, 5).map((day) => (
              <div key={day} className="space-y-3">
                <h3 className="text-sm font-bold text-text-primary border-b border-card-border pb-2">{day}</h3>
                <div className="h-24 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
            {DAYS.slice(0, 5).map((day) => {
              const daySlots = slotsByDay[day] || []
              return (
                <div key={day} className="space-y-3 bg-white p-4 card border border-card-border min-h-[400px] flex flex-col">
                  <h3 className="text-sm font-extrabold text-primary border-b border-slate-100 pb-2 mb-2 tracking-tight">
                    {day}
                  </h3>

                  {daySlots.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-12 text-center text-text-muted text-xs font-normal">
                      No Classes
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 p-3 rounded-lg flex flex-col justify-between space-y-2 relative group transition-colors"
                        >
                          {/* Trash button */}
                          <button
                            onClick={() => setDeletingSlot(slot)}
                            className="absolute top-2 right-2 text-text-muted hover:text-status-red p-1 bg-white border border-card-border rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            title="Delete slot"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                          <div className="space-y-1">
                            <span className="text-[10px] bg-blue-50 text-primary px-2 py-0.5 rounded-full font-bold border border-blue-100">
                              {slot.course.code}
                            </span>
                            <h4 className="text-xs font-bold text-text-primary leading-tight pt-1">
                              {slot.course.name}
                            </h4>
                          </div>

                          <div className="space-y-1 pt-1 text-[10px] text-text-secondary font-medium">
                            <p className="flex items-center gap-1">
                              <span></span> {formatTimeDisplay(slot.start_time)} – {formatTimeDisplay(slot.end_time)}
                            </p>
                            <p className="flex items-center gap-1">
                              <span></span> {slot.teacher.username}
                            </p>
                            <p className="flex items-center gap-1">
                              <span></span> {slot.room}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div className="p-16 text-center card bg-white text-text-muted text-sm font-semibold">
          Select a class from the dropdown menu to view the weekly schedule.
        </div>
      )}

      {/* ── CREATE TIMETABLE SLOT MODAL ── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Timetable Slot"
        description="Schedule a new class slot, course subject, and classroom room assignment."
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
              form="create-timetable-form"
              className="btn-primary"
              disabled={isSubmittingCreate}
            >
              {isSubmittingCreate ? 'Saving...' : 'Schedule Lecture'}
            </button>
          </>
        }
      >
        <form
          id="create-timetable-form"
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4"
        >
          {/* Class (Prefilled, Editable) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Class / Cohort</label>
            <select
              className="input bg-white"
              {...registerCreate('class_id', { required: 'Class selection is required' })}
            >
              <option value="">-- Select Class --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            {errorsCreate.class_id && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.class_id.message}</p>
            )}
          </div>

          {/* Course */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Subject Course</label>
            <select
              className="input bg-white"
              {...registerCreate('course_id', { required: 'Course selection is required' })}
              disabled={isCoursesLoading}
            >
              <option value="">-- Select Course --</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </select>
            {errorsCreate.course_id && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.course_id.message}</p>
            )}
          </div>

          {/* Teacher */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-secondary">Assigned Instructor</label>
            <select
              className="input bg-white"
              {...registerCreate('teacher_id', { required: 'Teacher selection is required' })}
              disabled={isTeachersLoading}
            >
              <option value="">-- Select Teacher --</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.username}
                </option>
              ))}
            </select>
            {errorsCreate.teacher_id && (
              <p className="text-xs text-status-red font-medium">{errorsCreate.teacher_id.message}</p>
            )}
          </div>

          {/* Day & Room */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Day of Week</label>
              <select
                className="input bg-white"
                {...registerCreate('day', { required: true })}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Classroom / Room</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Room 302"
                {...registerCreate('room', { required: 'Room is required' })}
              />
              {errorsCreate.room && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.room.message}</p>
              )}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Start Time</label>
              <input
                type="time"
                className="input"
                {...registerCreate('start_time', { required: 'Start time is required' })}
              />
              {errorsCreate.start_time && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.start_time.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">End Time</label>
              <input
                type="time"
                className="input"
                {...registerCreate('end_time', { required: 'End time is required' })}
              />
              {errorsCreate.end_time && (
                <p className="text-xs text-status-red font-medium">{errorsCreate.end_time.message}</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── DELETE SLOT CONFIRMATION MODAL ── */}
      <ConfirmModal
        isOpen={!!deletingSlot}
        onClose={() => setDeletingSlot(null)}
        onConfirm={handleDelete}
        title="Remove Timetable Slot"
        message={`Are you sure you want to remove the timetable entry for '${deletingSlot?.course?.name}' on ${deletingSlot?.day} (${formatTimeDisplay(deletingSlot?.start_time)} – ${formatTimeDisplay(deletingSlot?.end_time)})?`}
        confirmLabel="Remove"
        danger
        loading={deleteSlotMutation.isPending}
      />
    </div>
  )
}
