import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import axiosInstance from '@api/axios.js'

export default function AdminTeachers() {
  const [search, setSearch] = useState('')

  // Fetch Users with teacher filter
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['adminTeachersList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/users', { params: { limit: 100, role: 'teacher' } })
      return data
    }
  })

  // Filter teachers based on search input
  const filteredTeachers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Teacher Directory</h1>
        <p className="text-sm text-[#64748b] mt-1">Manage and view all registered faculty/teachers in the system.</p>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="text-xs font-semibold text-[#64748b]">
          Total Teachers: {filteredTeachers.length}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 space-y-4">
            <div className="h-6 w-1/4 bg-slate-100 rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 font-semibold">
            Error loading teachers: {error.message}
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl">👨‍🏫</span>
            <h3 className="font-bold text-sm text-[#0f172a]">No teachers found</h3>
            <p className="text-xs max-w-xs">No user records matching 'teacher' role or search criteria were found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">ID</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Username</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Email</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Created At</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {filteredTeachers.map((teacher, idx) => (
                  <tr key={teacher.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/80 transition-colors`}>
                    <td className="p-4 text-xs font-bold text-[#0f172a]">{teacher.id}</td>
                    <td className="p-4 text-xs font-semibold text-[#0f172a]">{teacher.username}</td>
                    <td className="p-4 text-xs text-[#64748b]">{teacher.email}</td>
                    <td className="p-4 text-xs text-[#64748b]">
                      {teacher.created_at ? format(parseISO(teacher.created_at), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${
                        teacher.is_active
                          ? 'text-green-600 bg-green-50 border-green-200 shadow-sm'
                          : 'text-red-600 bg-red-50 border-red-200 shadow-sm'
                      }`}>
                        {teacher.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
