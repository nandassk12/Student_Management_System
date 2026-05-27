import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import Modal from '@components/Modal.jsx'

export default function TeacherGrades() {
  const queryClient = useQueryClient()

  // Filter States
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [selectedYear, setSelectedYear] = useState('2025-2026')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [activeModal, setActiveModal] = useState(null) // { student, gradeRecord }
  const [modalMarks, setModalMarks] = useState('')
  const [modalGrade, setModalGrade] = useState('')

  // ── Queries: Classes & Courses ───────────────────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['teacherClassesGrades'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/classes', { params: { limit: 100 } })
      return data
    }
  })

  const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['teacherCoursesGrades'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses', { params: { limit: 100 } })
      return data
    }
  })

  // ── Query: Class Roster ──────────────────────────────────────────────────────
  const { data: roster = [], isLoading: isRosterLoading } = useQuery({
    queryKey: ['classRosterGrades', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return []
      const { data } = await axiosInstance.get(`/enrollment/class/${selectedClass}`)
      return data
    },
    enabled: !!selectedClass
  })

  // ── Query: Class Grades ──────────────────────────────────────────────────────
  const { data: gradesList = [], isLoading: isGradesLoading, refetch: refetchGrades } = useQuery({
    queryKey: ['classGradesList', selectedClass, selectedCourse, selectedSemester],
    queryFn: async () => {
      if (!selectedClass || !selectedCourse || !selectedSemester) return []
      const { data } = await axiosInstance.get(`/grades/class/${selectedClass}`, {
        params: {
          course_id: Number(selectedCourse),
          semester: Number(selectedSemester),
          limit: 100
        }
      })
      return data
    },
    enabled: !!selectedClass && !!selectedCourse && !!selectedSemester
  })

  // ── Mutations: Save / Edit Grade ─────────────────────────────────────────────
  const createGradeMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/grades', payload)
      return data
    },
    onSuccess: () => {
      toast.success('Grade recorded successfully!')
      queryClient.invalidateQueries({ queryKey: ['classGradesList'] })
      queryClient.invalidateQueries({ queryKey: ['teacherDashboard'] })
      handleCloseModal()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to record grade.'
      toast.error(typeof detail === 'string' ? detail : 'Validation error.')
    }
  })

  const updateGradeMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await axiosInstance.put(`/grades/${id}`, payload)
      return data
    },
    onSuccess: () => {
      toast.success('Grade updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['classGradesList'] })
      handleCloseModal()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to update grade.'
      toast.error(typeof detail === 'string' ? detail : 'Validation error.')
    }
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getSuggestedGrade = (marksVal) => {
    const marks = parseFloat(marksVal)
    if (isNaN(marks) || marks < 0 || marks > 100) return ''
    if (marks >= 90) return 'A'
    if (marks >= 80) return 'B'
    if (marks >= 70) return 'C'
    if (marks >= 60) return 'D'
    return 'F'
  }

  const handleMarksChange = (val) => {
    setModalMarks(val)
    const suggested = getSuggestedGrade(val)
    if (suggested) {
      setModalGrade(suggested)
    }
  }

  const handleOpenModal = (student, gradeRecord = null) => {
    setActiveModal({ student, gradeRecord })
    if (gradeRecord) {
      setModalMarks(String(gradeRecord.marks))
      setModalGrade(gradeRecord.grade)
    } else {
      setModalMarks('')
      setModalGrade('')
    }
  }

  const handleCloseModal = () => {
    setActiveModal(null)
    setModalMarks('')
    setModalGrade('')
  }

  const handleModalSubmit = (e) => {
    e.preventDefault()
    const marks = parseFloat(modalMarks)

    if (isNaN(marks) || marks < 0 || marks > 100) {
      toast.error('Marks must be a number between 0 and 100.')
      return
    }

    if (!modalGrade) {
      toast.error('Please select a grade letter.')
      return
    }

    // Validate Academic Year Format (YYYY-YYYY)
    const yearParts = selectedYear.split('-')
    if (
      yearParts.length !== 2 ||
      yearParts[0].length !== 4 ||
      yearParts[1].length !== 4 ||
      isNaN(Number(yearParts[0])) ||
      isNaN(Number(yearParts[1])) ||
      Number(yearParts[1]) !== Number(yearParts[0]) + 1
    ) {
      toast.error("Academic Year must be in YYYY-YYYY format, with the second year exactly one year after the first (e.g. '2025-2026').")
      return
    }

    if (activeModal.gradeRecord) {
      updateGradeMutation.mutate({
        id: activeModal.gradeRecord.id,
        payload: {
          marks,
          grade: modalGrade,
          semester: Number(selectedSemester),
          academic_year: selectedYear
        }
      })
    } else {
      createGradeMutation.mutate({
        student_id: activeModal.student.id,
        course_id: Number(selectedCourse),
        marks,
        grade: modalGrade,
        semester: Number(selectedSemester),
        academic_year: selectedYear
      })
    }
  }

  // Map students to grades
  const rosterWithGrades = roster.map((item) => {
    const student = item.student
    const gradeRecord = gradesList.find((g) => g.student_id === student.id)
    return {
      student,
      gradeRecord
    }
  })

  // Filter Roster
  const filteredRoster = rosterWithGrades.filter(({ student }) => {
    const name = student.full_name || student.username || ''
    const email = student.email || ''
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // Grade Pill styling based on Letter Grade
  const getGradePillClass = (letter) => {
    switch (letter) {
      case 'A': return 'text-green-700 bg-green-50 border-green-200 shadow-[0_1px_3px_rgba(22,163,74,0.1)]'
      case 'B': return 'text-blue-700 bg-blue-50 border-blue-200 shadow-[0_1px_3px_rgba(37,99,235,0.1)]'
      case 'C': return 'text-yellow-700 bg-yellow-50 border-yellow-200 shadow-[0_1px_3px_rgba(202,138,4,0.1)]'
      case 'D': return 'text-orange-700 bg-orange-50 border-orange-200 shadow-[0_1px_3px_rgba(234,88,12,0.1)]'
      case 'F': return 'text-red-700 bg-red-50 border-red-200 shadow-[0_1px_3px_rgba(220,38,38,0.1)]'
      default: return 'text-slate-400 bg-slate-50 border-slate-200'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Grade Input Panel</h1>
        <p className="text-sm text-text-muted mt-1">Provide, record, or modify grades and marks for class roster.</p>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 card bg-white">
        {/* Class Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Class / Cohort</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input bg-white font-semibold"
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

        {/* Course Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Course / Subject</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="input bg-white font-semibold"
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

        {/* Semester Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Semester</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="input bg-white font-semibold"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Year */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Academic Year</label>
          <input
            type="text"
            placeholder="e.g. 2025-2026"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input font-semibold"
          />
        </div>
      </div>

      {/* Roster & Grade Input Grid */}
      {!selectedClass || !selectedCourse ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-card-border">
            🏆
          </div>
          <h3 className="font-bold text-text-primary text-lg">Select Class and Course</h3>
          <p className="text-sm max-w-md">
            Please choose a class and course from the filters to view students and record academic grades.
          </p>
        </div>
      ) : (
        <div className="card bg-white overflow-hidden">
          {/* Table Header Filter Search */}
          <div className="p-4 border-b border-card-border bg-slate-50/50 flex items-center justify-between">
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
            <div className="text-xs text-text-secondary font-medium">
              Academic Period: <span className="font-bold text-primary">{selectedYear}</span> | Semester: <span className="font-bold text-primary">{selectedSemester}</span>
            </div>
          </div>

          {/* Table Body */}
          {isRosterLoading || isGradesLoading ? (
            <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-semibold">Loading roster & grades...</span>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="p-12 text-center text-text-muted">
              No students found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-card-border bg-slate-50/20">
                    <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Student Info</th>
                    <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">Marks (100)</th>
                    <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">Grade Letter</th>
                    <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-center">GPA Scale</th>
                    <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-wider text-right w-44">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {filteredRoster.map(({ student, gradeRecord }) => {
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-navy-50 text-primary border border-navy-100 flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                              {(student.full_name || student.username || '??').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-text-primary">
                                {student.full_name || student.username}
                              </h4>
                              <p className="text-xs text-text-muted mt-0.5">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {gradeRecord ? (
                            <span className="text-sm font-bold text-text-primary">{gradeRecord.marks}</span>
                          ) : (
                            <span className="text-xs text-text-muted italic">Not Entered</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {gradeRecord ? (
                            <span className={`inline-block px-3 py-1 text-xs font-black rounded-full border ${getGradePillClass(gradeRecord.grade)}`}>
                              {gradeRecord.grade}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {gradeRecord ? (
                            <span className="text-xs font-semibold text-text-secondary">
                              {gradeRecord.gpa_points.toFixed(1)} / 4.0
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {gradeRecord ? (
                            <button
                              type="button"
                              onClick={() => handleOpenModal(student, gradeRecord)}
                              className="btn-secondary py-1.5 px-3.5 text-xs bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              Edit Grade
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenModal(student)}
                              className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5 justify-center ml-auto"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                              Input Grade
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grade Entry/Edit Modal */}
      <Modal
        isOpen={!!activeModal}
        onClose={handleCloseModal}
        title={activeModal?.gradeRecord ? 'Modify Grade Record' : 'Input New Grade Record'}
        description={`Record academic performance for student ${activeModal?.student?.full_name || activeModal?.student?.username}`}
        footer={
          <>
            <button
              type="button"
              onClick={handleCloseModal}
              className="btn-secondary py-2 px-4"
              disabled={createGradeMutation.isPending || updateGradeMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="grade-form"
              className="btn-primary py-2 px-4"
              disabled={createGradeMutation.isPending || updateGradeMutation.isPending}
            >
              {createGradeMutation.isPending || updateGradeMutation.isPending
                ? 'Saving...'
                : activeModal?.gradeRecord
                ? 'Update Grade'
                : 'Input Grade'}
            </button>
          </>
        }
      >
        {activeModal && (
          <form id="grade-form" onSubmit={handleModalSubmit} className="space-y-4">
            {/* Meta Read-Only Info */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-card-border rounded-lg text-xs font-semibold text-text-secondary">
              <div>
                <span className="text-text-muted">Subject ID:</span> {selectedCourse}
              </div>
              <div>
                <span className="text-text-muted">Semester:</span> {selectedSemester}
              </div>
              <div>
                <span className="text-text-muted">Academic Year:</span> {selectedYear}
              </div>
              <div>
                <span className="text-text-muted">Student ID:</span> {activeModal.student.id}
              </div>
            </div>

            {/* Marks Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Marks Scored (out of 100)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={modalMarks}
                onChange={(e) => handleMarksChange(e.target.value)}
                placeholder="e.g. 84.5"
                className="input"
                required
                autoFocus
              />
            </div>

            {/* Grade Select */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-secondary">Letter Grade (Select or suggested)</label>
              <select
                value={modalGrade}
                onChange={(e) => setModalGrade(e.target.value)}
                className="input bg-white"
                required
              >
                <option value="">-- Choose Grade --</option>
                <option value="A">Grade A (90-100) — 4.0 GPA</option>
                <option value="B">Grade B (80-89) — 3.0 GPA</option>
                <option value="C">Grade C (70-79) — 2.0 GPA</option>
                <option value="D">Grade D (60-69) — 1.0 GPA</option>
                <option value="F">Grade F (Below 60) — 0.0 GPA</option>
              </select>
              <p className="text-[11px] text-text-muted">
                Note: Standard grade suggestion is applied automatically when marks are typed, but can be overridden.
              </p>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
