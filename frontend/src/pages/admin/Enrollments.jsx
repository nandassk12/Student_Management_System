import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import axiosInstance from '@api/axios.js'
import Modal, { ConfirmModal } from '@components/Modal.jsx'

export default function AdminEnrollments() {
  const queryClient = useQueryClient()
  const [selectedClassId, setSelectedClassId] = useState('')
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [studentIdToEnroll, setStudentIdToEnroll] = useState('')
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState(null)

  // ── Query: Fetch Classes ──────────────────────────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['adminEnrollmentsClassesList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/classes')
      return data
    }
  })

  // ── Query: Fetch Roster for Selected Class ────────────────────────────────────
  const { data: roster = [], isLoading: isRosterLoading } = useQuery({
    queryKey: ['adminEnrollmentsRoster', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return []
      const { data } = await axiosInstance.get(`/enrollment/class/${selectedClassId}`)
      return data
    },
    enabled: !!selectedClassId
  })

  // ── Query: Fetch Students for Dropdown ────────────────────────────────────────
  const { data: students = [] } = useQuery({
    queryKey: ['adminEnrollmentsAllStudents'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/users', { params: { limit: 100, role: 'student' } })
      return data
    },
    enabled: isEnrollModalOpen
  })

  // ── Mutation: Enroll Student ──────────────────────────────────────────────────
  const enrollMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/enrollment', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEnrollmentsRoster', selectedClassId] })
      toast.success('Student enrolled successfully!')
      setIsEnrollModalOpen(false)
      setStudentIdToEnroll('')
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to enroll student.'
      toast.error(typeof detail === 'string' ? detail : 'Student is already enrolled.')
    }
  })

  // ── Mutation: Remove Enrollment ───────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/enrollment/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEnrollmentsRoster', selectedClassId] })
      toast.success('Enrollment removed successfully!')
      setDeletingEnrollmentId(null)
    },
    onError: () => {
      toast.error('Failed to remove enrollment.')
      setDeletingEnrollmentId(null)
    }
  })

  const handleEnrollSubmit = (e) => {
    e.preventDefault()
    if (!studentIdToEnroll || !selectedClassId) {
      toast.error('Please select both a student and a class.')
      return
    }
    enrollMutation.mutate({
      student_id: parseInt(studentIdToEnroll, 10),
      class_id: parseInt(selectedClassId, 10)
    })
  }

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Class Enrollments</h1>
        <p className="text-sm text-[#64748b] mt-1">Enroll students into academic classes and manage roster lists.</p>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Select Class:</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={isClassesLoading}
            className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-white focus:border-[#1e3a5f] outline-none text-[#0f172a] font-semibold"
          >
            <option value="">-- Choose Class --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.section})
              </option>
            ))}
          </select>
        </div>

        {selectedClassId && (
          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-[#1e3a5f] hover:bg-[#0f172a] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Enroll Student
          </button>
        )}
      </div>

      {/* Roster Table Card */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        {!selectedClassId ? (
          <div className="p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl">📂</span>
            <h3 className="font-bold text-sm text-[#0f172a]">Select a Class</h3>
            <p className="text-xs max-w-xs">Please choose a class from the selector dropdown to review or modify its student roster.</p>
          </div>
        ) : isRosterLoading ? (
          <div className="p-12 space-y-4">
            <div className="h-6 w-1/4 bg-slate-100 rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : roster.length === 0 ? (
          <div className="p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl">👥</span>
            <h3 className="font-bold text-sm text-[#0f172a]">Class roster is empty</h3>
            <p className="text-xs max-w-xs">No students are currently enrolled in this class. Click 'Enroll Student' to add them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Enrollment ID</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Student Username</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Student Email</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Class Name</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {roster.map((enrollment, idx) => (
                  <tr key={enrollment.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/80 transition-colors`}>
                    <td className="p-4 text-xs font-bold text-[#0f172a]">{enrollment.id}</td>
                    <td className="p-4 text-xs font-semibold text-[#0f172a]">{enrollment.student?.username}</td>
                    <td className="p-4 text-xs text-[#64748b]">{enrollment.student?.email}</td>
                    <td className="p-4 text-xs font-semibold text-[#64748b]">{enrollment.class_?.name} ({enrollment.class_?.section})</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setDeletingEnrollmentId(enrollment.id)}
                        className="px-2.5 py-1 text-[10px] font-black rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors uppercase tracking-wider"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Enroll Student */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title="Enroll Student"
      >
        <form onSubmit={handleEnrollSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Student</label>
            <select
              value={studentIdToEnroll}
              onChange={(e) => setStudentIdToEnroll(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-white focus:border-[#1e3a5f] outline-none text-[#0f172a] font-semibold"
            >
              <option value="">-- Select Student --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.username} ({student.email})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-xs font-bold text-[#64748b] hover:bg-slate-50 transition-colors uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enrollMutation.isPending}
              className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#0f172a] text-white font-bold rounded-lg text-xs transition-colors uppercase"
            >
              {enrollMutation.isPending ? 'Enrolling...' : 'Confirm'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modal for Delete */}
      <ConfirmModal
        isOpen={deletingEnrollmentId !== null}
        onClose={() => setDeletingEnrollmentId(null)}
        onConfirm={() => deleteMutation.mutate(deletingEnrollmentId)}
        title="Remove Enrollment"
        message="Are you sure you want to withdraw this student's enrollment from this class? This action will remove them from class-specific timetables and notifications."
        confirmText="Remove"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
