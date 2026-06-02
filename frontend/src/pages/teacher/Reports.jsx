import axiosInstance from '@api/axios.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import RichNarrative from '../../components/RichNarrative.jsx'

// ── Custom Student Dropdown ──────────────────────────────────────────────────
// Data shape from GET /enrollment/class/{id}:
//   item = { id, student_id, class_id, student: { id, username, email }, roll_number }
function StudentDropdown({ selectedClass, isClassStudentsLoading, isGeneratingBulk, classStudents, selectedStudent, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const disabled = !selectedClass || isGeneratingBulk

  const getLabel = () => {
    if (!selectedStudent) return '-- Select Target --'
    if (selectedStudent === 'all') return '👥 All Students (Class)'
    const found = classStudents.find(item => String(item.student.id) === String(selectedStudent))
    if (!found) return '-- Select Target --'
    const name = found.student.username
    return `👤 ${found.roll_number ? found.roll_number + ' — ' : ''}${name}`
  }

  return (
    <div className="space-y-1.5" ref={ref} style={{ position: 'relative' }}>
      <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Student Selector</label>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          backgroundColor: disabled ? '#f8fafc' : '#fff',
          color: disabled ? '#94a3b8' : '#0f172a',
          fontWeight: 600,
          fontSize: '14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isClassStudentsLoading ? 'Loading students...' : getLabel()}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, marginLeft: 8, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999,
          maxHeight: '300px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* All Students (Class) — always first */}
          <button
            type="button"
            onClick={() => { onSelect('all'); setOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: selectedStudent === 'all' ? '#eff6ff' : 'transparent',
              color: selectedStudent === 'all' ? '#1e3a5f' : '#0f172a',
              fontWeight: selectedStudent === 'all' ? 700 : 600,
              fontSize: '13px',
              border: 'none',
              borderBottom: '2px solid #e2e8f0',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
            onMouseEnter={e => { if (selectedStudent !== 'all') e.currentTarget.style.backgroundColor = '#f8fafc' }}
            onMouseLeave={e => { if (selectedStudent !== 'all') e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <span>👥</span>
            <span>All Students (Class)</span>
          </button>

          {/* Loading indicator */}
          {isClassStudentsLoading && (
            <div style={{ padding: '14px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
              Loading students...
            </div>
          )}

          {/* Individual students from enrollment table — roll_number — username */}
          {!isClassStudentsLoading && classStudents.map((item, idx) => {
            const isSelected = String(selectedStudent) === String(item.student.id)
            const label = item.roll_number
              ? `${item.roll_number} — ${item.student.username}`
              : item.student.username
            return (
              <button
                key={item.student.id}
                type="button"
                onClick={() => { onSelect(String(item.student.id)); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                  color: isSelected ? '#1e3a5f' : '#334155',
                  fontWeight: isSelected ? 700 : 400,
                  fontSize: '13px',
                  border: 'none',
                  borderBottom: idx < classStudents.length - 1 ? '1px solid #f1f5f9' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <span style={{ fontSize: '15px' }}>👤</span>
                <span>{label}</span>
              </button>
            )
          })}

          {!isClassStudentsLoading && classStudents.length === 0 && (
            <div style={{ padding: '14px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
              No students enrolled in this class
            </div>
          )}
        </div>
      )}
    </div>
  )
}


export default function TeacherReports() {
  const queryClient = useQueryClient()

  // Filter & Generation States
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('') // "all" or student user id
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [selectedYear, setSelectedYear] = useState('2025-2026')
  const [searchQuery, setSearchQuery] = useState('')

  // Editing States for Narratives
  const [editingNarrativeId, setEditingNarrativeId] = useState(null)
  const [editedText, setEditedText] = useState('')

  // Bulk Generation Tracking States
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [bulkTotalCount, setBulkTotalCount] = useState(0)
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState('')

  // Delete Draft State
  const [deletingReportId, setDeletingReportId] = useState(null)

  // ── Queries: Classes & Students ───────────────────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['teacherClassesReports'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/timetable/teacher/me')
      // Extract unique classes from timetable slots by class_id
      const seen = new Set()
      const uniqueClasses = []
      for (const slot of data) {
        if (slot.class_ && !seen.has(slot.class_.id)) {
          seen.add(slot.class_.id)
          uniqueClasses.push(slot.class_)
        }
      }
      return uniqueClasses
    }
  })



  // Fetch students for the selected class via enrollment table (class_id → student details)
  const { data: classStudents = [], isLoading: isClassStudentsLoading } = useQuery({
    queryKey: ['classStudentsReports', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return []
      // Returns [{ id, student_id, class_id, student: { id, username, email }, roll_number }]
      const { data } = await axiosInstance.get(`/enrollment/class/${selectedClass}`)
      return data
    },
    enabled: !!selectedClass
  })


  // ── Query: Fetch student reports for review ──────────────────────────────────
  // If a student is selected, we fetch all their reports; if "all" is selected, we fetch the class reports
  const { data: reports = [], isLoading: isReportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ['studentReportsList', selectedClass, selectedStudent],
    queryFn: async () => {
      if (!selectedClass || !selectedStudent) return []
      if (selectedStudent === 'all') {
        const { data } = await axiosInstance.get(`/ai/reports/class/${selectedClass}`)
        return data
      } else {
        const { data } = await axiosInstance.get(`/ai/reports/student/${selectedStudent}`)
        return data
      }
    },
    enabled: !!selectedClass && !!selectedStudent
  })

  // ── Mutation: Generate Progress Report(s) ───────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/ai/reports/generate', payload, { timeout: 120_000 })
      return data
    },
    onSuccess: (data) => {
      if (data.errors && data.errors.length > 0) {
        toast.error(`Generated ${data.created} reports. ${data.errors.length} failed.`)
      } else {
        toast.success(`Successfully generated ${data.created} report(s)!`)
      }
      // If single student was selected, refresh the reports list
      if (selectedStudent && selectedStudent !== 'all') {
        refetchReports()
      }
      queryClient.invalidateQueries({ queryKey: ['studentReportsList'] })
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to generate report.'
      toast.error(typeof detail === 'string' ? detail : 'Failed to generate report.')
    }
  })

  // ── Mutation: Approve/Save Report ───────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await axiosInstance.put(`/ai/reports/${id}/approve`, payload)
      return data
    },
    onSuccess: () => {
      toast.success('Report approved & saved successfully!')
      setEditingNarrativeId(null)
      refetchReports()
      queryClient.invalidateQueries({ queryKey: ['studentReportsList'] })
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to approve report.'
      toast.error(typeof detail === 'string' ? detail : 'Approval failed.')
    }
  })

  // ── Mutation: Bulk Approve Reports ──────────────────────────────────────────
  const bulkApproveMutation = useMutation({
    onMutate: () => {
      setBulkSuccessMessage('')
    },
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/ai/reports/bulk-approve', payload)
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Successfully approved all drafts!')
      refetchReports()
      queryClient.invalidateQueries({ queryKey: ['studentReportsList'] })
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to bulk approve reports.'
      toast.error(typeof detail === 'string' ? detail : 'Bulk approval failed.')
    }
  })

  // ── Mutation: Delete Report ──────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosInstance.delete(`/ai/reports/${id}`)
      return data
    },
    onSuccess: () => {
      toast.success('Draft deleted successfully!')
      setDeletingReportId(null)
      refetchReports()
      queryClient.invalidateQueries({ queryKey: ['studentReportsList'] })
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? 'Failed to delete report.'
      toast.error(typeof detail === 'string' ? detail : 'Deletion failed.')
    }
  })

  // ── PDF Download handler ────────────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState(null)

  const handleDownloadPDF = async (reportId) => {
    setDownloadingId(reportId)
    try {
      const response = await axiosInstance.get(`/ai/reports/${reportId}/pdf`, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `academic_progress_report_${reportId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('PDF downloaded!')
    } catch (err) {
      toast.error('Failed to download PDF. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Submit Handlers ─────────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!selectedClass) {
      toast.error('Please select a Class.')
      return
    }
    if (!selectedStudent) {
      toast.error('Please select a student or "All Students".')
      return
    }

    const semesterNum = Number(selectedSemester)
    const academicYear = selectedYear

    setBulkSuccessMessage('')

    if (selectedStudent === 'all') {
      if (roster.length === 0) {
        toast.error('No students in the selected class roster.')
        return
      }

      setIsGeneratingBulk(true)
      setBulkTotalCount(roster.length)
      setBulkProgress(0)

      let successCount = 0
      let errors = []

      for (let i = 0; i < roster.length; i++) {
        const studentId = roster[i].student.id
        try {
          await axiosInstance.post('/ai/reports/generate', {
            student_id: studentId,
            semester: semesterNum,
            academic_year: academicYear
          })
          successCount++
        } catch (err) {
          const detail = err.response?.data?.detail ?? 'Failed'
          errors.push(`${roster[i].student.full_name || roster[i].student.username}: ${detail}`)
        }
        setBulkProgress(i + 1)
      }

      setIsGeneratingBulk(false)

      if (successCount > 0) {
        setBulkSuccessMessage(`Bulk Generation Complete. ${successCount} Drafts Ready for Review.`)
        toast.success(`Successfully generated ${successCount} reports!`)
      } else {
        toast.error('Bulk generation failed.')
      }

      if (errors.length > 0) {
        console.error('Bulk generation errors:', errors)
      }

      refetchReports()
      queryClient.invalidateQueries({ queryKey: ['studentReportsList'] })
    } else {
      generateMutation.mutate({
        student_id: Number(selectedStudent),
        semester: semesterNum,
        academic_year: academicYear
      })
    }
  }

  const handleBulkApprove = () => {
    if (!selectedClass) return
    bulkApproveMutation.mutate({
      class_id: Number(selectedClass),
      semester: Number(selectedSemester),
      academic_year: selectedYear
    })
  }

  const handleDelete = (reportId) => {
    deleteMutation.mutate(reportId)
  }

  const handleApprove = (reportId, originalNarrative) => {
    const isEditing = editingNarrativeId === reportId
    const textToSend = isEditing ? editedText : originalNarrative

    approveMutation.mutate({
      id: reportId,
      payload: {
        edited_narrative: textToSend
      }
    })
  }

  // Filtered reports list (by search query for student name or narrative)
  const filteredReports = reports.filter((r) => {
    const studentName = r.student_name || ''
    const narrative = r.edited_narrative || r.narrative || ''
    return (
      studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      narrative.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">AI Progress Reports</h1>
        <p className="text-sm text-[#64748b] mt-1">Generate narrative academic progress reports using AI, review/edit drafts, and approve them for students.</p>
      </div>

      {/* Generation Panel */}
      <div className="card bg-white p-6">
        <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-4">Generate New Report</h3>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Class Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value)
                setSelectedStudent('')
                setBulkSuccessMessage('')
                setDeletingReportId(null)
              }}
              className="input bg-white font-semibold"
              disabled={isClassesLoading || isGeneratingBulk}
              required
            >
              <option value="">-- Choose Class --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Select - Custom Dropdown */}
          <StudentDropdown
            selectedClass={selectedClass}
            isClassStudentsLoading={isClassStudentsLoading}
            isGeneratingBulk={isGeneratingBulk}
            classStudents={classStudents}
            selectedStudent={selectedStudent}
            onSelect={(val) => {
              setSelectedStudent(val)
              setBulkSuccessMessage('')
              setDeletingReportId(null)
            }}
          />


          {/* Semester Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value)
                setBulkSuccessMessage('')
                setDeletingReportId(null)
              }}
              className="input bg-white font-semibold"
              disabled={isGeneratingBulk}
              required
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
            <label className="text-xs font-bold text-[#475569] uppercase tracking-wider">Academic Year</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value)
                setBulkSuccessMessage('')
                setDeletingReportId(null)
              }}
              className="input bg-white font-semibold"
              disabled={isGeneratingBulk}
              required
            >
              <option value="2023-2024">2023-2024</option>
              <option value="2024-2025">2024-2025</option>
              <option value="2025-2026">2025-2026</option>
            </select>
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            className="btn-primary py-2.5 flex items-center justify-center gap-2"
            disabled={generateMutation.isPending || isGeneratingBulk}
          >
            {generateMutation.isPending || isGeneratingBulk ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>✨ Generate Reports</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Review Screen Panel */}
      <div className="grid grid-cols-1 gap-6">
        {isGeneratingBulk ? (
          <div className="card bg-white p-12 text-center text-[#64748b] flex flex-col items-center justify-center space-y-4 shadow-sm border border-[#e2e8f0]">
            <div className="w-10 h-10 rounded-full border-4 border-slate-100 border-t-[#1e3a5f] animate-spin" />
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">Generating Class Reports</h4>
              <p className="text-xs text-[#64748b] font-mono">
                Generating {bulkProgress} / {bulkTotalCount} reports...
              </p>
            </div>
            <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#1e3a5f] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(bulkProgress / bulkTotalCount) * 100}%` }}
              />
            </div>
          </div>
        ) : !selectedStudent ? (
          <div className="card bg-white p-12 text-center text-[#64748b] flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-[#e2e8f0]">
              ✍
            </div>
            <h3 className="font-bold text-[#0f172a] text-lg">Select a student to review reports</h3>
            <p className="text-sm max-w-md">
              Select a class and a specific student from the dropdowns above to view their progress report history, edit draft narratives, and approve them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Banner */}
            {bulkSuccessMessage && (
              <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm text-emerald-800 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{bulkSuccessMessage}</h4>
                    <p className="text-xs text-emerald-600">The newly generated student drafts are listed below for your review.</p>
                  </div>
                </div>
                <button
                  onClick={() => setBulkSuccessMessage('')}
                  className="text-emerald-400 hover:text-emerald-600 text-xs font-bold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search student reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex items-center gap-4">
                {selectedStudent === 'all' && reports.some(r => r.status === 'draft') && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkApproveMutation.isPending}
                    className="bg-[#1e3a5f] hover:bg-[#152e4d] disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    {bulkApproveMutation.isPending ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <span>⚡ Bulk Approve New Drafts</span>
                      </>
                    )}
                  </button>
                )}
                <div className="text-xs font-semibold text-[#64748b]">
                  Total Reports: {filteredReports.length}
                </div>
              </div>
            </div>

            {/* Reports List */}
            {isReportsLoading ? (
              <div className="card bg-white p-12 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Loading student reports...</span>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="card bg-white p-16 text-center text-[#64748b] flex flex-col items-center justify-center space-y-2">
                <span className="text-3xl">📄</span>
                <h3 className="font-bold text-sm text-[#0f172a]">No reports found</h3>
                <p className="text-xs max-w-xs">No academic progress reports have been generated for this student yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredReports.map((report) => {
                  const isEditing = editingNarrativeId === report.id
                  return (
                    <div key={report.id} className="card bg-white overflow-hidden border border-[#e2e8f0] hover:shadow-card-hover transition-all duration-300">
                      {/* Header block of single report */}
                      <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[#1e3a5f] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            Sem {report.semester}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {report.academic_year}
                          </span>
                          <span className="text-xs text-slate-400">
                            Created: {new Date(report.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider ${report.status === 'approved'
                              ? 'text-green-600 bg-green-50 border-green-200'
                              : 'text-amber-600 bg-amber-50 border-amber-200'
                            }`}>
                            {report.status}
                          </span>

                          {/* PDF download if approved */}
                          {report.status === 'approved' && (
                            <button
                              onClick={() => handleDownloadPDF(report.id)}
                              disabled={downloadingId === report.id}
                              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-300 text-slate-700 text-xs font-bold rounded border border-slate-200 transition-colors"
                            >
                              {downloadingId === report.id ? '...' : '📥 PDF'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Info Bar */}
                      <div className="px-6 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-medium block">Current CGPA</span>
                          <span className="text-sm font-bold text-[#0f172a]">{report.current_cgpa || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Attendance</span>
                          <span className="text-sm font-bold text-[#0f172a]">{report.overall_attendance}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Roll Number</span>
                          <span className="text-sm font-bold text-[#0f172a]">{report.roll_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Department</span>
                          <span className="text-sm font-bold text-[#0f172a]">{report.department || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Content Block */}
                      <div className="p-6 space-y-4">
                        {/* Narrative area */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Narrative Report Summary</h4>
                          {isEditing ? (
                            <textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              rows={16}
                              className="w-full p-4 border border-[#e2e8f0] rounded-lg text-xs focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] outline-none font-mono leading-relaxed bg-[#f8fafc]"
                            />
                          ) : (
                            <RichNarrative text={report.edited_narrative || report.narrative} />
                          )}
                        </div>

                        {/* Risk Flags */}
                        {report.risk_flags && report.risk_flags.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Risk Indicators</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {report.risk_flags.map((flag, idx) => (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded-lg border flex items-center gap-2.5 text-xs font-bold ${flag.level === 'critical'
                                      ? 'text-red-700 bg-red-50 border-red-200'
                                      : 'text-amber-700 bg-amber-50 border-amber-200'
                                    }`}
                                >
                                  <span>⚠</span>
                                  <span>{flag.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Panel for Draft reports */}
                        {report.status === 'draft' && (
                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div>
                              {!isEditing && (
                                deletingReportId === report.id ? (
                                  <div className="flex items-center gap-2 border border-red-200 bg-red-50 p-1 rounded-lg">
                                    <span className="text-xs text-red-700 font-medium">Are you sure?</span>
                                    <button
                                      onClick={() => handleDelete(report.id)}
                                      disabled={deleteMutation.isPending}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition-colors"
                                    >
                                      {deleteMutation.isPending ? '...' : 'Yes'}
                                    </button>
                                    <button
                                      onClick={() => setDeletingReportId(null)}
                                      className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded transition-colors"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeletingReportId(report.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Draft
                                  </button>
                                )
                              )}
                            </div>

                            <div className="flex gap-3">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => setEditingNarrativeId(null)}
                                    className="btn-secondary py-1.5 px-4 text-xs"
                                    disabled={approveMutation.isPending}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleApprove(report.id)}
                                    className="btn-primary py-1.5 px-4 text-xs"
                                    disabled={approveMutation.isPending}
                                  >
                                    {approveMutation.isPending ? 'Saving...' : 'Save & Approve'}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingNarrativeId(report.id)
                                      setEditedText(report.edited_narrative || report.narrative)
                                    }}
                                    className="btn-secondary py-1.5 px-4 text-xs hover:bg-slate-50"
                                  >
                                    Edit Narrative
                                  </button>
                                  <button
                                    onClick={() => handleApprove(report.id, report.edited_narrative || report.narrative)}
                                    className="btn-primary py-1.5 px-4 text-xs"
                                    disabled={approveMutation.isPending}
                                  >
                                    Approve Draft
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
