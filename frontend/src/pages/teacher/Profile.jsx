import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@api/axios.js'

export default function TeacherProfile() {
  const { data: me, isLoading, error } = useQuery({
    queryKey: ['teacherProfileSelf'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/auth/me')
      return data
    }
  })

  return (
    <div className="space-y-6 page-enter max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">My Profile</h1>
        <p className="text-sm text-[#64748b] mt-1">Review your active security credentials and system user identity.</p>
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
          <div className="h-12 bg-slate-50 rounded" />
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
              {(me.username || '??').substring(0, 2).toUpperCase()}
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h2 className="text-lg font-bold text-[#0f172a]">{me.username}</h2>
              <span className="inline-block px-2.5 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {me.role?.name || me.role || 'Teacher'}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 divide-y divide-[#e2e8f0]">
            <div className="py-3.5 flex justify-between items-center text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Account ID</span>
              <span className="font-mono text-[#0f172a] font-semibold bg-slate-100 px-2 py-0.5 rounded">{me.id}</span>
            </div>
            <div className="py-3.5 flex justify-between items-center text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Email Address</span>
              <span className="font-bold text-[#0f172a]">{me.email}</span>
            </div>
            <div className="py-3.5 flex justify-between items-center text-xs">
              <span className="font-bold text-[#64748b] uppercase tracking-wider">Registration Status</span>
              <span className="inline-flex px-2 py-0.5 text-[10px] font-black rounded-full border uppercase bg-green-50 border-green-200 text-green-600">
                Active
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
