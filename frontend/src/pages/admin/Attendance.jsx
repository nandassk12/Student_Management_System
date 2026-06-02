import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import axiosInstance from '@api/axios.js'

export default function AdminAttendance() {
  const [page, setPage] = useState(1)
  const limit = 10

  // Filters state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusVal, setStatusVal] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')

  // ── Query: Fetch Courses for filter dropdown ─────────────────────────────────
  const { data: courses = [] } = useQuery({
    queryKey: ['adminAttendanceCoursesList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses')
      return data
    }
  })

  // ── Query: Fetch Attendance Records ──────────────────────────────────────────
  const { data: attendance = [], isLoading, error } = useQuery({
    queryKey: ['adminAttendanceRecords', page, startDate, endDate, statusVal, courseFilter],
    queryFn: async () => {
      const params = {
        limit,
        skip: (page - 1) * limit
      }
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      if (statusVal !== 'all') params.status = statusVal
      if (courseFilter !== 'all') params.course_id = Number(courseFilter)

      const { data } = await axiosInstance.get('/attendance', { params })
      return data
    }
  })

  // Reset page when filters change
  const handleFilterChange = (setter, val) => {
    setter(val)
    setPage(1)
  }

  // Clear all date filters and reset to page 1
  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'present': return 'text-green-600 bg-green-50 border-green-200 shadow-sm'
      case 'absent': return 'text-red-600 bg-red-50 border-red-200 shadow-sm'
      default: return 'text-amber-600 bg-amber-50 border-amber-200 shadow-sm'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Attendance Ledger</h1>
        <p className="text-sm text-[#64748b] mt-1">Audit, track, and monitor daily student attendance metrics across all courses.</p>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        {/* Date Range Selector */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
            className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-xs bg-white text-[#0f172a] font-semibold outline-none focus:border-[#1e3a5f]"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
            className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-xs bg-white text-[#0f172a] font-semibold outline-none focus:border-[#1e3a5f]"
          />
        </div>

        {/* Clear date filters */}
        {(startDate || endDate) && (
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full px-3 py-1.5 text-xs font-bold text-primary border border-primary/30 bg-navy-50 rounded-lg hover:bg-primary hover:text-white transition-colors"
            >
              Clear Dates
            </button>
          </div>
        )}

        {/* Course Filter */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Course Syllabus</label>
          <select
            value={courseFilter}
            onChange={(e) => handleFilterChange(setCourseFilter, e.target.value)}
            className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-xs bg-white text-[#0f172a] font-semibold outline-none focus:border-[#1e3a5f]"
          >
            <option value="all">All Courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} ({course.code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Status Mode</label>
          <select
            value={statusVal}
            onChange={(e) => handleFilterChange(setStatusVal, e.target.value)}
            className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-xs bg-white text-[#0f172a] font-semibold outline-none focus:border-[#1e3a5f]"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Student</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Course</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Class</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">Marked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="p-4"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="p-4"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="p-4"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                    <td className="p-4"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="p-4 text-right"><div className="h-4 bg-slate-100 rounded w-20 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 font-semibold">
            Error loading attendance logs: {error.message}
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl">📅</span>
            <h3 className="font-bold text-sm text-[#0f172a]">No attendance logs found</h3>
            <p className="text-xs max-w-xs">There are no attendance sessions logged matching the active filter parameters.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Date</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Student</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Course</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Class</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">Marked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {attendance.map((record, idx) => (
                    <tr key={record.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/80 transition-colors`}>
                      <td className="p-4 text-xs font-semibold text-[#0f172a]">
                        {record.date ? format(parseISO(record.date), 'MMM dd, yyyy') : '—'}
                      </td>
                      <td className="p-4 text-xs font-bold text-[#0f172a]">{record.student?.username}</td>
                      <td className="p-4 text-xs text-[#64748b] font-semibold">{record.course?.name} ({record.course?.code})</td>
                      <td className="p-4 text-xs text-[#64748b] font-semibold">{record.class_?.name} (Sec {record.class_?.section})</td>
                      <td className="p-4 text-xs">
                        <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${getStatusBadgeStyle(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-bold text-[#64748b] text-right">
                        {record.marker?.username || 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-[#e2e8f0] bg-slate-50/30 flex justify-between items-center">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-[#64748b]">
                Page {page}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={attendance.length < limit}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
