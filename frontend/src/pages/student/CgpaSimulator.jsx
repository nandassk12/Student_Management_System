import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

export default function StudentCgpaSimulator() {
  const { user } = useAuth()

  // Form States
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [expectedMarks, setExpectedMarks] = useState(75)

  // Simulation list of courses
  const [simulatedCourses, setSimulatedCourses] = useState([])

  // Simulation API outputs
  const [simulationResult, setSimulationResult] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // Animated display CGPA ticker
  const [displayCgpa, setDisplayCgpa] = useState(0)

  // ── Query: Fetch Courses ──────────────────────────────────────────────────────
  const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['studentCoursesWhatIf'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses', { params: { limit: 100 } })
      return data
    }
  })

  // ── Query: Fetch Current CGPA ──────────────────────────────────────────────────
  const { data: currentCgpaData, isLoading: isCurrentCgpaLoading } = useQuery({
    queryKey: ['studentCurrentCgpa', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data } = await axiosInstance.get(`/grades/cgpa/${user.id}`)
      return data
    },
    enabled: !!user?.id
  })

  const initialCgpa = currentCgpaData?.cgpa || 0

  // Set initial display GPA once loaded
  useEffect(() => {
    if (initialCgpa !== undefined) {
      setDisplayCgpa(initialCgpa)
    }
  }, [initialCgpa])

  // ── Run simulation automatically when list changes ──────────────────────────
  useEffect(() => {
    if (simulatedCourses.length === 0 || !user?.id) {
      setSimulationResult(null)
      return
    }

    const triggerSimulation = async () => {
      setIsSimulating(true)
      try {
        const payload = simulatedCourses.map(item => ({
          course_id: item.course_id,
          expected_marks: Number(item.expected_marks)
        }))
        const { data } = await axiosInstance.post(`/grades/cgpa/predict/${user.id}`, payload)
        setSimulationResult(data)
      } catch (err) {
        const errorMsg = err.response?.data?.detail ?? 'Simulation failed.'
        toast.error(typeof errorMsg === 'string' ? errorMsg : 'Failed to run simulator.')
      } finally {
        setIsSimulating(false)
      }
    }

    // Debounce simulation requests slightly to prevent API spam while editing marks
    const delayDebounce = setTimeout(() => {
      triggerSimulation()
    }, 200)

    return () => clearTimeout(delayDebounce)
  }, [simulatedCourses, user?.id])

  // ── Ticker Animation for Predicted CGPA ───────────────────────────────────────
  useEffect(() => {
    if (!simulationResult) {
      setDisplayCgpa(initialCgpa)
      return
    }

    let start = displayCgpa
    const end = simulationResult.predicted_cgpa
    if (start === end) return

    const duration = 300 // ms
    const startTime = performance.now()

    const step = (timestamp) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const current = start + (end - start) * progress
      
      setDisplayCgpa(parseFloat(current.toFixed(2)))

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setDisplayCgpa(end)
      }
    }

    requestAnimationFrame(step)
  }, [simulationResult?.predicted_cgpa, initialCgpa])

  const handleAddCourse = () => {
    if (!selectedCourseId) return
    const course = courses.find(c => c.id === Number(selectedCourseId))
    if (!course) return
    
    // Prevent duplicates
    if (simulatedCourses.some(item => item.course_id === course.id)) {
      toast.error("This course is already added to the simulation.")
      return
    }

    setSimulatedCourses([
      ...simulatedCourses,
      {
        course_id: course.id,
        name: course.name,
        code: course.code,
        credits: course.credits || 3,
        semester: course.semester,
        expected_marks: expectedMarks
      }
    ])
    setSelectedCourseId('')
    setExpectedMarks(75)
    toast.success(`Added ${course.name} to simulator.`)
  }

  const handleRemoveCourse = (courseId) => {
    setSimulatedCourses(simulatedCourses.filter(item => item.course_id !== courseId))
    toast.success("Removed course from simulation.")
  }

  const handleUpdateMarks = (courseId, marks) => {
    setSimulatedCourses(
      simulatedCourses.map(item => 
        item.course_id === courseId ? { ...item, expected_marks: Number(marks) } : item
      )
    )
  }

  // 10-Point scale grade letter detail helper
  const get10PointGradeDetails = (m) => {
    if (m >= 90) return { letter: 'O', points: 10, pill: 'text-green-700 bg-green-50 border-green-200 shadow-[0_1px_2px_rgba(22,163,74,0.05)]' }
    if (m >= 80) return { letter: 'A+', points: 9, pill: 'text-blue-700 bg-blue-50 border-blue-200 shadow-[0_1px_2px_rgba(37,99,235,0.05)]' }
    if (m >= 70) return { letter: 'A', points: 8, pill: 'text-indigo-700 bg-indigo-50 border-indigo-200 shadow-[0_1px_2px_rgba(99,102,241,0.05)]' }
    if (m >= 60) return { letter: 'B+', points: 7, pill: 'text-purple-700 bg-purple-50 border-purple-200 shadow-[0_1px_2px_rgba(168,85,247,0.05)]' }
    if (m >= 50) return { letter: 'B', points: 6, pill: 'text-yellow-700 bg-yellow-50 border-yellow-200 shadow-[0_1px_2px_rgba(202,138,4,0.05)]' }
    if (m >= 40) return { letter: 'C', points: 5, pill: 'text-orange-700 bg-orange-50 border-orange-200 shadow-[0_1px_2px_rgba(234,88,12,0.05)]' }
    return { letter: 'F', points: 0, pill: 'text-red-700 bg-red-50 border-red-200 shadow-[0_1px_2px_rgba(220,38,38,0.05)]' }
  }

  // Accent Colors for Impact Badge
  const getImpactBadgeClass = (impact) => {
    switch (impact) {
      case 'positive': return 'text-status-green bg-green-50 border-green-200'
      case 'negative': return 'text-status-red bg-red-50 border-red-200'
      default: return 'text-slate-500 bg-slate-50 border-slate-200'
    }
  }

  // Filter courses list to exclude already added simulated courses
  const availableCourses = courses.filter(
    c => !simulatedCourses.some(item => item.course_id === c.id)
  )

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">CGPA Multi-Course Simulator</h1>
        <p className="text-sm text-text-muted mt-1">Estimate how expected grades in multiple hypothetical courses will impact your overall CGPA and semester GPAs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Parameter Form & Simulated Courses List */}
        <div className="lg:col-span-5 space-y-6">
          {/* Add Course Card */}
          <div className="card bg-white p-6 space-y-5">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Add Course to Simulation</h3>
            
            <div className="space-y-4">
              {/* Course Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Choose Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="input bg-white font-semibold text-xs py-2"
                  disabled={isCoursesLoading}
                >
                  <option value="">-- Select a Course --</option>
                  {availableCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} ({course.code}) - Sem {course.semester} ({course.credits || 3} Credits)
                    </option>
                  ))}
                </select>
              </div>

              {/* Marks Range input */}
              {selectedCourseId && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Expected Marks</label>
                    <span className="text-sm font-black text-primary">{expectedMarks} / 100</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={expectedMarks}
                    onChange={(e) => setExpectedMarks(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  />

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                    <span className="text-text-muted">Estimated Grade:</span>
                    <span className={`px-2 py-0.5 font-extrabold rounded-full border ${get10PointGradeDetails(expectedMarks).pill}`}>
                      {get10PointGradeDetails(expectedMarks).letter} ({get10PointGradeDetails(expectedMarks).points} Pts)
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddCourse}
                disabled={!selectedCourseId}
                className="w-full btn-primary py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Course
              </button>
            </div>
          </div>

          {/* Simulated Courses List */}
          <div className="card bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Simulated Courses</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-text-secondary border border-card-border">
                {simulatedCourses.length} Added
              </span>
            </div>

            {simulatedCourses.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-xs italic">
                No hypothetical grades added yet. Choose a course above to start simulating.
              </div>
            ) : (
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {simulatedCourses.map((course) => {
                  const gradeInfo = get10PointGradeDetails(course.expected_marks)
                  return (
                    <div 
                      key={course.course_id}
                      className="p-3.5 rounded-xl border border-card-border bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-text-primary leading-tight">{course.name}</h4>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {course.code} • Sem {course.semester} • {course.credits} Credits
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCourse(course.course_id)}
                          className="text-text-muted hover:text-status-red transition-colors p-1"
                          title="Remove from simulation"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Expected Marks Slider inside list */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-text-secondary uppercase">Projected Marks:</span>
                          <span className="font-black text-primary">{course.expected_marks} / 100</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={course.expected_marks}
                            onChange={(e) => handleUpdateMarks(course.course_id, e.target.value)}
                            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                          <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black rounded-full border text-center min-w-[54px] ${gradeInfo.pill}`}>
                            {gradeInfo.letter}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Simulation Output and Breakdown */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="card bg-white p-8 flex-1 flex flex-col justify-between space-y-8">
            <div>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Simulated CGPA Forecast</h3>
              <p className="text-[10px] text-text-muted mt-0.5">Comparative standing of your projected academic path.</p>
            </div>

            {simulatedCourses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-text-muted space-y-3">
                <div className="text-4xl animate-bounce">⚖️</div>
                <h4 className="font-bold text-sm text-text-secondary">Input course parameters to simulate</h4>
                <p className="text-xs max-w-xs leading-relaxed">
                  Select hypothetical course parameters and marks on the left to recalculate your CGPA.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {/* GPA comparison display */}
                <div className="flex items-center justify-center gap-8 md:gap-14 border-b border-dashed border-card-border pb-6">
                  {/* Current CGPA */}
                  <div className="text-center">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Current CGPA</span>
                    <h3 className="text-4xl font-black text-text-secondary tracking-tight mt-1.5">
                      {initialCgpa.toFixed(2)}
                    </h3>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="text-2xl text-text-muted font-bold select-none">&rarr;</div>

                  {/* Predicted CGPA with animated ticker */}
                  <div className="text-center">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Predicted CGPA</span>
                    <div className="relative inline-block mt-1.5">
                      <h3 className="text-4xl font-black text-primary tracking-tight">
                        {displayCgpa.toFixed(2)}
                      </h3>
                      {isSimulating && (
                        <div className="absolute -top-1 -right-4 w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Impact Info */}
                {simulationResult && (
                  <div className="space-y-6">
                    {/* Impact Badge */}
                    <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all duration-300 ${getImpactBadgeClass(simulationResult.impact)}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {simulationResult.impact === 'positive' ? '📈' : simulationResult.impact === 'negative' ? '📉' : '⚖️'}
                        </span>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider">
                            {simulationResult.impact} Impact
                          </p>
                          <p className="text-[10px] text-text-secondary font-medium mt-0.5 leading-relaxed">
                            {simulationResult.impact === 'positive' 
                              ? 'Excellent! This course plan will push your CGPA score higher.' 
                              : simulationResult.impact === 'negative' 
                              ? 'Warning: This course plan will drag down your cumulative score.' 
                              : 'No overall net change to your current CGPA.'}
                          </p>
                        </div>
                      </div>

                      <span className="text-base font-black whitespace-nowrap">
                        {simulationResult.difference >= 0 ? '+' : ''}{simulationResult.difference.toFixed(2)}
                      </span>
                    </div>

                    {/* Semester-wise Breakdown Table */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-1">
                        Predicted Semester standing
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-card-border">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-card-border text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                              <th className="p-3">Semester</th>
                              <th className="p-3 text-center">Current SGPA</th>
                              <th className="p-3 text-center">Simulated SGPA</th>
                              <th className="p-3 text-right">Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-card-border text-xs">
                            {simulationResult.breakdown.map((semItem) => {
                              const currSem = currentCgpaData?.semesters?.find(s => s.semester === semItem.semester)
                              const currSgpa = currSem ? currSem.sgpa : 0.0
                              const diff = semItem.sgpa - currSgpa
                              return (
                                <tr key={semItem.semester} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 font-bold text-text-secondary">Semester {semItem.semester}</td>
                                  <td className="p-3 text-center text-text-muted font-medium">
                                    {currSem ? currSgpa.toFixed(2) : 'N/A'}
                                  </td>
                                  <td className="p-3 text-center font-bold text-text-primary">
                                    {semItem.sgpa.toFixed(2)}
                                  </td>
                                  <td className="p-3 text-right">
                                    {diff === 0 ? (
                                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                                        0.00
                                      </span>
                                    ) : diff > 0 ? (
                                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold bg-green-50 text-status-green border border-green-200">
                                        +{diff.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold bg-red-50 text-status-red border border-red-200">
                                        {diff.toFixed(2)}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-[10px] text-text-muted italic border-t border-card-border/60 pt-4">
              Disclaimer: Simulator forecasts are prospective projections. Final CGPA calculations are locked upon registrar approval of actual grades.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
