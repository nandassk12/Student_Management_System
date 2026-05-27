import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'

export default function TeacherAttendance() {
  const queryClient = useQueryClient()

  // Form states
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchQuery, setSearchQuery] = useState('')

  // Local unsaved selections: { [studentId]: 'present' | 'absent' | 'late' }
  const [selections, setSelections] = useState({})
  
  // Track which student IDs are already saved in DB to disable editing
  const [savedRecords, setSavedRecords] = useState({}) // { [studentId]: status }

  // Restrict date input to today or past
  const maxDate = format(new Date(), 'yyyy-MM-dd')

  // ── Query: Fetch Classes ──────────────────────────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['teacherClasses'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/classes', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Query: Fetch Courses ──────────────────────────────────────────────────────
  const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['teacherCourses'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses', {
        params: { limit: 100 }
      })
      return data
    }
  })

  // ── Query: Fetch Student Roster ──────────────────────────────────────────────
  const { data: roster = [], isLoading: isRosterLoading, error: rosterError } = useQuery({
    queryKey: ['classRoster', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return []
      const { data } = await axiosInstance.get(`/enrollment/class/${selectedClass}`)
      return data
    },
    enabled: !!selectedClass
  })

  // ── Query: Fetch Existing Attendance Records ─────────────────────────────────
  const { data: existingAttendance = [], isLoading: isAttendanceLoading } = useQuery({
    queryKey: ['existingAttendance', selectedClass, selectedCourse, selectedDate],
    queryFn: async () => {
      if (!selectedClass || !selectedCourse || !selectedDate) return []
      const { data } = await axiosInstance.get(`/attendance/class/${selectedClass}`, {
        params: {
          course_id: Number(selectedCourse),
          start_date: selectedDate,
          end_date: selectedDate,
          limit: 100
        }
      })
      return data
    },
    enabled: !!selectedClass && !!selectedCourse && !!selectedDate
  })

  // Update selection states when roster or existing records load
  useEffect(() => {
    if (!selectedClass || !selectedCourse) {
      setSelections({})
      setSavedRecords({})
      return
    }

    const saved = {}
    const initialSelections = {}

    // Populate existing saved records from backend
    existingAttendance.forEach((record) => {
      saved[record.student_id] = record.status
      initialSelections[record.student_id] = record.status
    })

    // For any students in roster who don't have records yet, set selections to empty (unmarked)
    roster.forEach((item) => {
      const sId = item.student_id
      if (!saved[sId]) {
        initialSelections[sId] = null
      }
    })

    setSavedRecords(saved)
    setSelections(initialSelections)
  }, [roster, existingAttendance, selectedClass, selectedCourse, selectedDate])

  // ── Mutation: Save Attendance ──────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveAttendance = async () => {
    const studentsToSubmit = roster.filter(
      (item) => selections[item.student_id] && !savedRecords[item.student_id]
    )

    if (studentsToSubmit.length === 0) {
      toast.error('No new attendance selections to save.')
      return
    }

    setIsSaving(true)
    const toastId = toast.loading(`Saving attendance for ${studentsToSubmit.length} students...`)

    try {
      const promises = studentsToSubmit.map((item) => {
        return axiosInstance.post('/attendance', {
          student_id: item.student_id,
          course_id: Number(selectedCourse),
          class_id: Number(selectedClass),
          date: selectedDate,
          status: selections[item.student_id]
        })
      })

      await Promise.all(promises)
      
      toast.success('Attendance saved successfully!', { id: toastId })
      
      // Invalidate existing attendance query to trigger reload
      queryClient.invalidateQueries({
        queryKey: ['existingAttendance', selectedClass, selectedCourse, selectedDate]
      })
      // Also invalidate dashboard queries to update today's attendance count
      queryClient.invalidateQueries({ queryKey: ['teacherDashboard'] })
    } catch (err) {
      const errorMsg = err.response?.data?.detail ?? 'Some attendance submissions failed.'
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Failed to save attendance.', { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle single student toggle selection
  const handleToggleStatus = (studentId, status) => {
    if (savedRecords[studentId]) return // Read-only once saved

    setSelections((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status // Toggle off if clicked again
    }))
  }

  // Bulk action: Mark all unsaved students as Present
  const handleMarkAllPresent = () => {
    setSelections((prev) => {
      const updated = { ...prev }
      roster.forEach((item) => {
        const sId = item.student_id
        if (!savedRecords[sId]) {
          updated[sId] = 'present'
        }
      })
      return updated
    })
    toast.success('Marked all editable students as Present!')
  }

  // Bulk action: Mark all unsaved students as Absent
  const handleMarkAllAbsent = () => {
    setSelections((prev) => {
      const updated = { ...prev }
      roster.forEach((item) => {
        const sId = item.student_id
        if (!savedRecords[sId]) {
          updated[sId] = 'absent'
        }
      })
      return updated
    })
    toast.success('Marked all editable students as Absent!')
  }

  // Bulk action: Reset unsaved selections
  const handleResetSelections = () => {
    setSelections((prev) => {
      const updated = { ...prev }
      roster.forEach((item) => {
        const sId = item.student_id
        if (!savedRecords[sId]) {
          updated[sId] = null
        }
      })
      return updated
    })
  }

  // Filter roster by search query
  const filteredRoster = roster.filter((item) => {
    const student = item.student
    const name = student.full_name || student.username || ''
    const email = student.email || ''
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // Calculate live session statistics for display
  const stats = {
    total: roster.length,
    present: Object.values(selections).filter((s) => s === 'present').length,
    absent: Object.values(selections).filter((s) => s === 'absent').length,
    late: Object.values(selections).filter((s) => s === 'late').length,
    unmarked: roster.filter((item) => !selections[item.student_id]).length,
  }

  const attendanceRate = stats.total > 0 
    ? Math.round(((stats.present + stats.late) / stats.total) * 100) 
    : 0

  return (
    <div className="space-y-6 page-enter">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Student Attendance</h1>
          <p className="text-sm text-text-muted mt-1">Select class, course, and date to mark daily attendance roster.</p>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 card bg-white">
        {/* Class Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Class / Cohort</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value)
              setSearchQuery('')
            }}
            className="input bg-white font-medium"
            disabled={isClassesLoading}
          >
            <option value="">-- Choose Class --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} (Semester {cls.semester})
              </option>
            ))}
          </select>
        </div>

        {/* Course Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Course / Subject</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="input bg-white font-medium"
            disabled={isCoursesLoading}
          >
            <option value="">-- Choose Course --</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} ({course.code})
              </option>
            ))}
          </select>
        </div>

        {/* Date Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Session Date</label>
          <input
            type="date"
            value={selectedDate}
            max={maxDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input font-medium"
          />
        </div>
      </div>

      {/* Roster Area */}
      {!selectedClass || !selectedCourse ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-card-border">
            📝
          </div>
          <h3 className="font-bold text-text-primary text-lg">Choose parameters to begin</h3>
          <p className="text-sm max-w-md">
            Please choose a class and course from the drop-downs above to load the student list and record attendance.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Indicators & Session Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 card bg-white flex flex-col justify-between">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Enrolled</span>
              <span className="text-2xl font-black text-text-primary mt-2">{stats.total}</span>
            </div>
            <div className="p-4 card bg-white flex flex-col justify-between border-l-4 border-l-status-green">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Present</span>
              <span className="text-2xl font-black text-status-green mt-2">{stats.present}</span>
            </div>
            <div className="p-4 card bg-white flex flex-col justify-between border-l-4 border-l-slate-400">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Late</span>
              <span className="text-2xl font-black text-slate-500 mt-2">{stats.late}</span>
            </div>
            <div className="p-4 card bg-white flex flex-col justify-between border-l-4 border-l-text-primary">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Absent</span>
              <span className="text-2xl font-black text-text-primary mt-2">{stats.absent}</span>
            </div>
            <div className="col-span-2 lg:col-span-1 p-4 card bg-white flex flex-col justify-between">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Attendance Rate</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl font-black text-primary">{attendanceRate}%</span>
                <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Roster List / Controls Card */}
          <div className="card bg-white overflow-hidden">
            {/* Toolbar controls */}
            <div className="p-4 border-b border-card-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Search */}
              <div className="relative max-w-xs w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9 py-1.5 text-xs"
                />
              </div>

              {/* Bulk operations */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="btn-secondary py-1.5 px-3 text-xs bg-slate-50 border-slate-200 text-slate-700 font-semibold"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={handleMarkAllAbsent}
                  className="btn-secondary py-1.5 px-3 text-xs bg-slate-50 border-slate-200 text-slate-700 font-semibold"
                >
                  Mark All Absent
                </button>
                <button
                  type="button"
                  onClick={handleResetSelections}
                  className="text-xs text-text-muted hover:text-text-primary px-2 transition-colors"
                >
                  Reset Unsaved
                </button>
              </div>
            </div>

            {/* Student Table */}
            {isRosterLoading || isAttendanceLoading ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Loading roster & records...</span>
              </div>
            ) : rosterError ? (
              <div className="p-8 text-center text-status-red bg-red-50/50">
                Failed to load class roster: {rosterError.message}
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="p-12 text-center text-text-muted">
                No students found in this class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-slate-50/20">
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider w-80">Student Info</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">Status Picker</th>
                      <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-36">Database State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {filteredRoster.map((item) => {
                      const student = item.student
                      const isSaved = !!savedRecords[student.id]
                      const activeStatus = selections[student.id]

                      return (
                        <tr 
                          key={student.id} 
                          className={`hover:bg-slate-50/30 transition-colors ${
                            isSaved ? 'opacity-85 bg-slate-50/10' : ''
                          }`}
                        >
                          {/* Student identity */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar circle */}
                              <div className="w-9 h-9 rounded-full bg-navy-50 text-primary border border-navy-100 flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                                {(student.full_name || student.username || '??').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-text-primary truncate">
                                  {student.full_name || student.username}
                                </h4>
                                <p className="text-xs text-text-muted truncate mt-0.5">{student.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Toggle controls */}
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-4">
                              {/* Present button: Navy */}
                              <button
                                type="button"
                                disabled={isSaved}
                                onClick={() => handleToggleStatus(student.id, 'present')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all duration-200 flex items-center gap-1 ${
                                  activeStatus === 'present'
                                    ? 'bg-primary border-primary text-white scale-105 shadow-[0_0_10px_rgba(30,58,95,0.25)]'
                                    : 'bg-white border-card-border text-text-secondary hover:bg-slate-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                Present
                              </button>

                              {/* Absent button: Outlined Black */}
                              <button
                                type="button"
                                disabled={isSaved}
                                onClick={() => handleToggleStatus(student.id, 'absent')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all duration-200 flex items-center gap-1 ${
                                  activeStatus === 'absent'
                                    ? 'bg-text-primary border-text-primary text-white scale-105 shadow-[0_0_10px_rgba(15,23,42,0.25)]'
                                    : 'bg-white border-card-border text-text-secondary hover:bg-slate-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                Absent
                              </button>

                              {/* Late button: Grey */}
                              <button
                                type="button"
                                disabled={isSaved}
                                onClick={() => handleToggleStatus(student.id, 'late')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all duration-200 flex items-center gap-1 ${
                                  activeStatus === 'late'
                                    ? 'bg-slate-500 border-slate-500 text-white scale-105 shadow-[0_0_10px_rgba(100,116,139,0.25)]'
                                    : 'bg-white border-card-border text-text-secondary hover:bg-slate-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                Late
                              </button>
                            </div>
                          </td>

                          {/* Record status flag */}
                          <td className="p-4 text-right">
                            {isSaved ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-status-green bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Saved
                              </span>
                            ) : activeStatus ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-amber bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                Unsaved Change
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted italic">Unmarked</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Footer Submit */}
            <div className="p-4 border-t border-card-border bg-slate-50/30 flex items-center justify-between">
              <span className="text-xs text-text-muted">
                Only newly marked statuses will be sent to the database. Already saved attendance is protected.
              </span>
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving || isRosterLoading || isAttendanceLoading || roster.length === 0}
                className="btn-primary flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Attendance
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
