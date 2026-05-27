import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import axiosInstance from '@api/axios.js'
import Modal from '@components/Modal.jsx'

export default function StudentProfile() {
  const queryClient = useQueryClient()
  const [isEditOpen, setIsEditOpen] = useState(false)

  // ── Query: Fetch Student Profile ──────────────────────────────────────────────
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['studentProfileSelf'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/profile/me')
      return data
    },
    retry: false // Don't retry on 404
  })

  // Form hooks
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm()

  // ── Mutation: Update Profile ──────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.put('/profile/me', payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studentProfileSelf'] })
      toast.success('Profile updated successfully!')
      setIsEditOpen(false)
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to update profile.'
      toast.error(typeof detail === 'string' ? detail : 'Validation error.')
    }
  })

  const onEditClick = () => {
    setIsEditOpen(true)
    reset({
      dob: profile?.dob ?? '',
      blood_group: profile?.blood_group ?? '',
      phone: profile?.phone ?? '',
      address: profile?.address ?? '',
      emergency_contact: profile?.emergency_contact ?? ''
    })
  }

  const onSubmit = (data) => {
    updateMutation.mutate({
      dob: data.dob || null,
      blood_group: data.blood_group || null,
      phone: data.phone || null,
      address: data.address || null,
      emergency_contact: data.emergency_contact || null
    })
  }

  const isProfileNotFound = error && error.response?.status === 404

  return (
    <div className="space-y-6 page-enter max-w-3xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Student Profile</h1>
          <p className="text-sm text-[#64748b] mt-1">Manage your biographical information, emergency contacts, and academic metadata.</p>
        </div>
        {profile && (
          <button
            onClick={onEditClick}
            className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#0f172a] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm uppercase tracking-wider"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Profile
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 space-y-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-slate-100 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-1/4" />
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-slate-50 rounded" />
            <div className="h-10 bg-slate-50 rounded" />
          </div>
        </div>
      ) : isProfileNotFound ? (
        <div className="bg-white rounded-xl border border-dashed border-[#e2e8f0] p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-3">
          <span className="text-4xl">🎓</span>
          <h3 className="font-bold text-sm text-[#0f172a]">Profile not set up yet</h3>
          <p className="text-xs max-w-md">Your student profile record has not been established. Please contact the administrator to assign your roll number, class, and department mapping.</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-red-500 font-semibold">
          Error loading profile: {error.message}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
          {/* Header Card area */}
          <div className="p-6 flex flex-col sm:flex-row items-center gap-5 border-b border-[#e2e8f0] bg-slate-50/20">
            {/* Avatar block */}
            <div className="w-16 h-16 rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] border-2 border-[#1e3a5f]/20 flex items-center justify-center text-xl font-extrabold flex-shrink-0">
              {(profile.user?.username || '??').substring(0, 2).toUpperCase()}
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h2 className="text-lg font-bold text-[#0f172a]">{profile.user?.username}</h2>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-block px-2.5 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  Roll No: {profile.roll_number}
                </span>
                <span className="inline-block px-2.5 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider bg-slate-100 text-[#1e3a5f] border border-slate-200">
                  {profile.class_?.name} ({profile.class_?.section})
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="py-2.5 flex justify-between border-b border-slate-100 text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Department</span>
              <span className="font-semibold text-[#0f172a]">{profile.department?.name}</span>
            </div>
            <div className="py-2.5 flex justify-between border-b border-slate-100 text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Class Section</span>
              <span className="font-semibold text-[#0f172a]">{profile.class_?.name} (Sec {profile.class_?.section})</span>
            </div>
            <div className="py-2.5 flex justify-between border-b border-slate-100 text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Date of Birth</span>
              <span className="font-semibold text-[#0f172a]">
                {profile.dob ? format(parseISO(profile.dob), 'MMMM dd, yyyy') : '—'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between border-b border-slate-100 text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Blood Group</span>
              <span className="font-semibold text-[#0f172a] uppercase">{profile.blood_group || '—'}</span>
            </div>
            <div className="py-2.5 flex justify-between border-b border-slate-100 text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Phone</span>
              <span className="font-semibold text-[#0f172a]">{profile.phone || '—'}</span>
            </div>
            <div className="py-2.5 flex justify-between border-b border-slate-100 text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Emergency Contact</span>
              <span className="font-semibold text-[#0f172a]">{profile.emergency_contact || '—'}</span>
            </div>
            <div className="py-2.5 flex justify-between border-b border-slate-100 text-xs md:col-span-2">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Mailing Address</span>
              <span className="font-semibold text-[#0f172a] text-right max-w-sm break-words">{profile.address || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Profile */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Personal Information"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Date of Birth</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-white outline-none text-[#0f172a]"
                {...register('dob')}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Blood Group</label>
              <input
                type="text"
                placeholder="e.g. O+"
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-white outline-none text-[#0f172a]"
                {...register('blood_group')}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. +91 9876543210"
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-white outline-none text-[#0f172a]"
              {...register('phone')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Emergency Contact</label>
            <input
              type="text"
              placeholder="e.g. Parents Name (+91 9988776655)"
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-white outline-none text-[#0f172a]"
              {...register('emergency_contact')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Mailing Address</label>
            <textarea
              rows="3"
              placeholder="Enter your complete home address..."
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-white outline-none text-[#0f172a] resize-none"
              {...register('address')}
            />
          </div>

          <div className="pt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-xs font-bold text-[#64748b] hover:bg-slate-50 transition-colors uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || updateMutation.isPending}
              className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#0f172a] text-white font-bold rounded-lg text-xs transition-colors uppercase"
            >
              {isSubmitting || updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
