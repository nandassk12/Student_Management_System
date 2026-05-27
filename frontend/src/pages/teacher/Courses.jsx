import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@api/axios.js'

export default function TeacherCourses() {
  const [search, setSearch] = useState('')

  // Fetch Courses
  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: ['teacherCoursesList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses')
      return data
    }
  })

  // Filter courses based on search
  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Syllabus Curriculum</h1>
        <p className="text-sm text-[#64748b] mt-1">Review the list of courses, credits, and semester mappings across departments.</p>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="text-xs font-semibold text-[#64748b]">
          Total Courses: {filteredCourses.length}
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
            Error loading courses: {error.message}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl">📚</span>
            <h3 className="font-bold text-sm text-[#0f172a]">No courses found</h3>
            <p className="text-xs max-w-xs">No course syllabus records matching your search query were found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Code</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Course Name</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider">Department</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-center">Credits</th>
                  <th className="p-4 text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">Semester</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {filteredCourses.map((course, idx) => (
                  <tr key={course.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/80 transition-colors`}>
                    <td className="p-4 text-xs font-extrabold text-[#1e3a5f] uppercase tracking-wider">{course.code}</td>
                    <td className="p-4 text-xs font-bold text-[#0f172a]">{course.name}</td>
                    <td className="p-4 text-xs text-[#64748b] font-semibold">{course.department?.name || '—'}</td>
                    <td className="p-4 text-xs text-[#0f172a] text-center font-bold">{course.credits} Credits</td>
                    <td className="p-4 text-xs text-[#64748b] text-right font-black">Semester {course.semester}</td>
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
