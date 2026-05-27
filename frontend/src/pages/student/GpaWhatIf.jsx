import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'
import { useAuth } from '@context/AuthContext.jsx'

export default function StudentGpaWhatIf() {
  const { user } = useAuth()

  // Form States
  const [courseId, setCourseId] = useState('')
  const [expectedMarks, setExpectedMarks] = useState(75)

  // Simulation output state
  const [simulation, setSimulation] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // Animated display GPA ticker
  const [displayGpa, setDisplayGpa] = useState(0)

  // ── Query: Fetch Courses ──────────────────────────────────────────────────────
  const { data: courses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['studentCoursesWhatIf'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/courses', { params: { limit: 100 } })
      return data
    }
  })

  // ── Query: Fetch Initial GPA ──────────────────────────────────────────────────
  const { data: initialGpa = 0 } = useQuery({
    queryKey: ['studentInitialGpa', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0
      const { data } = await axiosInstance.get(`/grades/gpa/${user.id}`)
      return data.gpa
    },
    enabled: !!user?.id
  })

  // Set initial display GPA once loaded
  useEffect(() => {
    if (initialGpa !== undefined) {
      setDisplayGpa(initialGpa)
    }
  }, [initialGpa])

  // ── Run simulation automatically when inputs change ──────────────────────────
  useEffect(() => {
    if (!courseId || !user?.id) {
      setSimulation(null)
      return
    }

    const triggerSimulation = async () => {
      setIsSimulating(true)
      try {
        const { data } = await axiosInstance.post(`/grades/whatif/${user.id}`, {
          course_id: Number(courseId),
          expected_marks: Number(expectedMarks)
        })
        setSimulation(data)
      } catch (err) {
        const errorMsg = err.response?.data?.detail ?? 'Simulation failed.'
        toast.error(typeof errorMsg === 'string' ? errorMsg : 'Failed to run simulator.')
      } finally {
        setIsSimulating(false)
      }
    }

    // Debounce simulation requests slightly to prevent API spam while sliding
    const delayDebounce = setTimeout(() => {
      triggerSimulation()
    }, 200)

    return () => clearTimeout(delayDebounce)
  }, [courseId, expectedMarks, user?.id])

  // ── Ticker Animation for Predicted GPA ───────────────────────────────────────
  useEffect(() => {
    if (!simulation) {
      setDisplayGpa(initialGpa)
      return
    }

    let start = displayGpa
    const end = simulation.predicted_gpa
    if (start === end) return

    const duration = 300 // ms
    const startTime = performance.now()

    const step = (timestamp) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const current = start + (end - start) * progress
      
      setDisplayGpa(parseFloat(current.toFixed(2)))

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setDisplayGpa(end)
      }
    }

    requestAnimationFrame(step)
  }, [simulation?.predicted_gpa, initialGpa])

  // Helper letter grade suggestor for display
  const getLetterFromMarks = (m) => {
    if (m >= 90) return 'A (4.0 Points)'
    if (m >= 80) return 'B (3.0 Points)'
    if (m >= 70) return 'C (2.0 Points)'
    if (m >= 60) return 'D (1.0 Point)'
    return 'F (0.0 Points)'
  }

  // Accent Colors for Impact Badge
  const getImpactBadgeClass = (impact) => {
    switch (impact) {
      case 'positive': return 'text-status-green bg-green-50 border-green-200'
      case 'negative': return 'text-status-red bg-red-50 border-red-200'
      default: return 'text-slate-500 bg-slate-50 border-slate-200'
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">GPA Simulator</h1>
        <p className="text-sm text-text-muted mt-1">Estimate how a target grade in a course impacts your overall cumulative GPA.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Panel (Left) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card bg-white p-6 space-y-6">
            <h3 className="text-base font-bold text-text-primary">What-If Parameters</h3>
            
            <div className="space-y-5">
              {/* Course select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Choose Course</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
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
                <p className="text-[10px] text-text-muted">
                  Note: If you have an existing grade in this course, it will be replaced in the simulation.
                </p>
              </div>

              {/* Slider for Marks */}
              {courseId && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Expected Marks</label>
                    <span className="text-lg font-black text-primary">{expectedMarks} / 100</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={expectedMarks}
                    onChange={(e) => setExpectedMarks(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  />

                  {/* Marks Letter Suggestion */}
                  <div className="p-3 bg-slate-50 border border-card-border rounded-lg text-center text-xs">
                    <span className="text-text-muted">Estimated Grade Letter:</span>{' '}
                    <span className="font-extrabold text-primary">{getLetterFromMarks(expectedMarks)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Display Output Card (Right) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="card bg-white p-8 flex-1 flex flex-col justify-between space-y-8">
            <div>
              <h3 className="text-base font-bold text-text-primary">Simulated GPA Output</h3>
              <p className="text-xs text-text-muted mt-0.5">Comparative forecast of your academic progression.</p>
            </div>

            {!courseId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-text-muted space-y-2">
                <div className="text-3xl">⚖️</div>
                <h4 className="font-bold text-sm text-text-secondary">Input course parameters to simulate</h4>
                <p className="text-xs max-w-xs mt-1">Select a course on the left and set your expected target marks to compute a predicted GPA.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {/* GPA comparison display */}
                <div className="flex items-center justify-center gap-8 md:gap-12">
                  {/* Current GPA */}
                  <div className="text-center">
                    <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Current GPA</span>
                    <h3 className="text-3xl md:text-4xl font-black text-text-secondary tracking-tight mt-1">
                      {initialGpa.toFixed(2)}
                    </h3>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="text-2xl text-text-muted font-bold animate-pulse">&rarr;</div>

                  {/* Predicted GPA with animated ticker */}
                  <div className="text-center">
                    <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Predicted GPA</span>
                    <div className="relative inline-block mt-1">
                      <h3 className="text-3xl md:text-4xl font-black text-primary tracking-tight">
                        {displayGpa.toFixed(2)}
                      </h3>
                      {isSimulating && (
                        <div className="absolute -top-1 -right-4 w-2 h-2 rounded-full bg-primary animate-ping" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Impact Info */}
                {simulation && (
                  <div className="space-y-4 max-w-md mx-auto w-full">
                    {/* Impact Badge */}
                    <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${getImpactBadgeClass(simulation.impact)}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {simulation.impact === 'positive' ? '📈' : simulation.impact === 'negative' ? '📉' : '⚖️'}
                        </span>
                        <div>
                          <p className="text-xs font-black capitalize">
                            {simulation.impact} Impact
                          </p>
                          <p className="text-[10px] text-text-secondary font-medium mt-0.5">
                            {simulation.impact === 'positive' 
                              ? 'This grade will improve your cumulative score.' 
                              : simulation.impact === 'negative' 
                              ? 'Your average GPA score will decrease.' 
                              : 'No change to your current cumulative GPA.'}
                          </p>
                        </div>
                      </div>

                      <span className="text-sm font-black whitespace-nowrap">
                        {simulation.difference >= 0 ? '+' : ''}{simulation.difference.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-[10px] text-text-muted italic border-t border-card-border/60 pt-4">
              Disclaimer: Simulator results are mathematical projections. Actual semester outcomes are computed when final courses are published.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
