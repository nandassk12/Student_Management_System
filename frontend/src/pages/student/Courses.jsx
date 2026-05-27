import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axiosInstance from '@api/axios.js'

export default function StudentCourses() {
  const [search, setSearch] = useState('')

  // Fetch Courses
  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: ['studentCoursesList'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses')
      return data
    }
  })

  // Filter courses based on search query
  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Academic Syllabus</h1>
        <p className="text-sm text-[#64748b] mt-1">Explore all the academic curriculum courses, credit counts, and semester breakdowns.</p>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search course code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="text-xs font-semibold text-[#64748b]">
          Showing {filteredCourses.length} of {courses.length} courses
        </div>
      </div>

      {/* Courses Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-50 border border-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-red-500 font-semibold">
          Error loading syllabus courses: {error.message}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
          <span className="text-3xl">📚</span>
          <h3 className="font-bold text-sm text-[#0f172a]">No courses found</h3>
          <p className="text-xs max-w-xs">There are no courses matching your search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div 
              key={course.id}
              className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#1e3a5f] text-[10px] font-black uppercase tracking-wider">
                    {course.code}
                  </span>
                  <span className="text-xs font-bold text-[#64748b]">
                    Semester {course.semester}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#0f172a] mt-4 tracking-tight leading-snug">
                  {course.name}
                </h3>
                <p className="text-xs text-[#64748b] font-medium mt-1">
                  Department: <span className="text-[#0f172a] font-semibold">{course.department?.name || '—'}</span>
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="font-bold text-[#64748b] uppercase tracking-wider">Weightage</span>
                <span className="font-black text-[#1e3a5f] bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100">
                  {course.credits} Credits
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
